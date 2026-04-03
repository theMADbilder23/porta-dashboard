import { POLL_INTERVAL_MS } from "./config.js";
import {
  fetchWallets,
  insertSnapshot,
  insertHoldings,
  fetchWalletDaySnapshotsWithHoldings,
} from "./db.js";
import { cleanWallet, isValidWallet, safeNumber } from "./utils.js";
import { collectCustomProtocols } from "./protocols/index.js";
import { collectQubicHoldings } from "./chains/qubic/index.js";
import { enrichHolding } from "./transforms/holdings.js";
import { applySnapshotTransforms } from "./transforms/snapshots.js";

import {
  collectDebankData,
  getTopTokens,
  getTopProtocols,
} from "./sources/debank.js";

import {
  getMerklWellRewards,
  buildSnapshotMetrics,
} from "./sources/merkl.js";

import {
  getStkWellBalance,
  buildStkWellHolding,
  buildStkWellRewardHolding,
} from "./sources/moonwell.js";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isRewardHolding(holding) {
  return normalizeText(holding?.category) === "reward";
}

function isMamoHolding(holding) {
  const symbol = normalizeText(holding?.token_symbol);
  const name = normalizeText(holding?.token_name);
  const protocol = normalizeText(holding?.protocol);

  return symbol === "mamo" || name.includes("mamo") || protocol === "mamo";
}

function isMamoRewardHolding(holding) {
  return (
    isRewardHolding(holding) &&
    normalizeText(holding?.protocol) === "mamo"
  );
}

function sumRewardHoldingsUsd(holdings = []) {
  return holdings.reduce((sum, holding) => {
    if (!isRewardHolding(holding)) return sum;
    return sum + safeNumber(holding?.value_usd || 0);
  }, 0);
}

function sumRewardHoldingsAmount(holdings = [], rewardTokenSymbol = null) {
  const normalizedTarget = normalizeText(rewardTokenSymbol);

  return holdings.reduce((sum, holding) => {
    if (!isRewardHolding(holding)) return sum;

    if (normalizedTarget) {
      const symbol = normalizeText(holding?.token_symbol);
      if (symbol !== normalizedTarget) return sum;
    }

    return sum + safeNumber(holding?.amount || 0);
  }, 0);
}

function getSnapshotRewardSymbol({
  merklMetrics,
  customRewardHoldings,
  mamoMeta,
}) {
  if (mamoMeta?.hasRewards) {
    return mamoMeta.rewardsTokenSymbol || "MAMO";
  }

  const hasMamoRewards = customRewardHoldings.some(isMamoRewardHolding);

  if (hasMamoRewards) {
    return "MAMO";
  }

  return merklMetrics?.rewards_token_symbol || null;
}

function getSnapshotClaimableTokenAmount({
  merklMetrics,
  customRewardHoldings,
  rewardsTokenSymbol,
}) {
  const normalizedRewardSymbol = normalizeText(rewardsTokenSymbol);

  if (!normalizedRewardSymbol) return 0;

  let total = 0;

  if (
    normalizeText(merklMetrics?.rewards_token_symbol) ===
    normalizedRewardSymbol
  ) {
    total += safeNumber(merklMetrics?.total_claimable_token || 0);
  }

  total += sumRewardHoldingsAmount(customRewardHoldings, rewardsTokenSymbol);

  return total;
}

function buildHoldingInsertRows({
  holdings,
  snapshotId,
  walletId,
  snapshotTime,
}) {
  return holdings.map((holding) => {
    const enriched = enrichHolding(holding);

    return {
      snapshot_id: snapshotId,
      wallet_id: walletId,
      token_symbol: enriched.token_symbol,
      token_name: enriched.token_name,
      network: enriched.network,
      amount: enriched.amount,
      value_usd: enriched.value_usd,
      category: enriched.category,
      protocol: enriched.protocol,
      is_yield_position: enriched.is_yield_position,
      snapshot_time: snapshotTime,

      asset_id: enriched.asset_id || null,
      asset_class: enriched.asset_class || null,
      yield_profile: enriched.yield_profile || null,
      mmii_bucket: enriched.mmii_bucket || null,
      mmii_subclass: enriched.mmii_subclass || null,
      price_source: enriched.price_source || null,
      price_per_unit_usd: safeNumber(enriched.price_per_unit_usd || 0),
      position_role: enriched.position_role || null,
    };
  });
}

async function collectQubicWallet(wallet) {
  const snapshotTime = new Date().toISOString();

  const result = await collectQubicHoldings({
    wallet,
    snapshotId: null,
    snapshotTime,
  });

  const snapshotPayload = {
    wallet_id: wallet.id,
    total_value_usd: safeNumber(result?.snapshotMetrics?.total_value_usd || 0),
    total_rewards_usd: safeNumber(
      result?.snapshotMetrics?.total_rewards_usd || 0
    ),
    total_claimed_usd: safeNumber(
      result?.snapshotMetrics?.total_claimed_usd || 0
    ),
    total_pending_usd: safeNumber(
      result?.snapshotMetrics?.total_pending_usd || 0
    ),
    total_claimable_usd: safeNumber(
      result?.snapshotMetrics?.total_claimable_usd || 0
    ),
    total_claimable_token: safeNumber(
      result?.snapshotMetrics?.total_claimable_token || 0
    ),
    rewards_token_symbol: result?.snapshotMetrics?.rewards_token_symbol || null,
    merkl_rewards_json: null,
    snapshot_time: snapshotTime,
  };

  const snapshot = await insertSnapshot(snapshotPayload);

  const rawHoldings = Array.isArray(result?.holdings) ? result.holdings : [];

  const holdingRows = buildHoldingInsertRows({
    holdings: rawHoldings,
    snapshotId: snapshot.id,
    walletId: wallet.id,
    snapshotTime,
  });

  await insertHoldings(holdingRows);

  console.log(
    JSON.stringify(
      {
        wallet_name: wallet.name || null,
        wallet_address: wallet.wallet_address || null,
        network_group: wallet.network_group || null,
        role_used: wallet.role || null,
        collector_path: "qubic",
        snapshot_id: snapshot.id,
        holdings_count: holdingRows.length,
        snapshot_metrics: {
          total_value_usd: snapshotPayload.total_value_usd,
          total_rewards_usd: snapshotPayload.total_rewards_usd,
          total_claimed_usd: snapshotPayload.total_claimed_usd,
          total_pending_usd: snapshotPayload.total_pending_usd,
          total_claimable_usd: snapshotPayload.total_claimable_usd,
          total_claimable_token: snapshotPayload.total_claimable_token,
          rewards_token_symbol: snapshotPayload.rewards_token_symbol,
        },
        holdings: holdingRows,
      },
      null,
      2
    )
  );
}

async function collectStandardWallet(wallet) {
  const cleanedAddress = cleanWallet(wallet.wallet_address);

  if (!isValidWallet(cleanedAddress)) {
    console.warn(
      `[collector] Skipping invalid wallet: ${wallet.name || "Unnamed"} (${wallet.wallet_address})`
    );
    return;
  }

  const snapshotTime = new Date().toISOString();
  const roleUsed = wallet.role || "core";

  const [debankData, merklRewards, stkWellAmount] = await Promise.all([
    collectDebankData(cleanedAddress),
    getMerklWellRewards(cleanedAddress),
    getStkWellBalance(cleanedAddress),
  ]);

  const rawCustomProtocolHoldings = await collectCustomProtocols(wallet, {
    walletAddress: cleanedAddress,
    snapshotTime,
    debankData,
    merklRewards,
    stkWellAmount,
  });

  const daySnapshots = await fetchWalletDaySnapshotsWithHoldings(
    wallet.id,
    snapshotTime
  );

  const transformedSnapshot = applySnapshotTransforms({
    snapshotTime,
    rawHoldings: rawCustomProtocolHoldings,
    daySnapshots,
  });

  const customProtocolHoldings = Array.isArray(transformedSnapshot?.holdings)
    ? transformedSnapshot.holdings
    : rawCustomProtocolHoldings;

  const mamoMeta = transformedSnapshot?.mamo || {
    hasRewards: false,
    currentPendingUsd: 0,
    completedCyclesUsd: 0,
    dailyAccruedUsd: 0,
    rewardsTokenSymbol: null,
  };

  const totalWalletValue = safeNumber(debankData?.totalWalletValue || 0);
  const chainCount = Array.isArray(debankData?.usedChains)
    ? debankData.usedChains.length
    : 0;

  const topTokens = getTopTokens(
    debankData?.allTokens,
    totalWalletValue,
    roleUsed,
    5,
    25
  );

  const topProtocols = getTopProtocols(debankData?.allProtocols, 5, 25);

  const stkWellHolding = buildStkWellHolding(
    stkWellAmount,
    safeNumber(merklRewards?.price || 0),
    snapshotTime
  );

  const stkWellRewardHolding = buildStkWellRewardHolding(
    merklRewards,
    snapshotTime
  );

  const merklMetrics = buildSnapshotMetrics(merklRewards);

  const hasCustomMamo = customProtocolHoldings.some(isMamoHolding);

  const filteredTopTokens = hasCustomMamo
    ? topTokens.filter((holding) => !isMamoHolding(holding))
    : topTokens;

  const filteredTopProtocols = hasCustomMamo
    ? topProtocols.filter((holding) => !isMamoHolding(holding))
    : topProtocols;

  const allHoldings = [
    ...filteredTopTokens,
    ...filteredTopProtocols,
    ...(stkWellHolding ? [stkWellHolding] : []),
    ...(stkWellRewardHolding ? [stkWellRewardHolding] : []),
    ...customProtocolHoldings,
  ];

  const customRewardHoldings = customProtocolHoldings.filter(isRewardHolding);
  const customRewardsUsd = sumRewardHoldingsUsd(customRewardHoldings);

  const rewardsTokenSymbol = getSnapshotRewardSymbol({
    merklMetrics,
    customRewardHoldings,
    mamoMeta,
  });

  const totalClaimableToken = getSnapshotClaimableTokenAmount({
    merklMetrics,
    customRewardHoldings,
    rewardsTokenSymbol,
  });

  const snapshotPayload = {
    wallet_id: wallet.id,
    total_value_usd: totalWalletValue,
    total_rewards_usd:
      safeNumber(merklMetrics.total_rewards_usd) + safeNumber(customRewardsUsd),
    total_claimed_usd: safeNumber(merklMetrics.total_claimed_usd),
    total_pending_usd:
      safeNumber(merklMetrics.total_pending_usd) + safeNumber(customRewardsUsd),
    total_claimable_usd:
      safeNumber(merklMetrics.total_claimable_usd) +
      safeNumber(customRewardsUsd),
    total_claimable_token: totalClaimableToken,
    rewards_token_symbol: rewardsTokenSymbol,
    merkl_rewards_json: merklMetrics.merkl_rewards_json || null,
    snapshot_time: snapshotTime,
  };

  const snapshot = await insertSnapshot(snapshotPayload);

  const holdingRows = buildHoldingInsertRows({
    holdings: allHoldings,
    snapshotId: snapshot.id,
    walletId: wallet.id,
    snapshotTime,
  });

  await insertHoldings(holdingRows);

  console.log(
    JSON.stringify(
      {
        wallet_name: wallet.name || null,
        wallet_address: cleanedAddress,
        network_group: wallet.network_group || null,
        role_used: roleUsed,
        collector_path: "standard",
        total_value_usd: totalWalletValue,
        chain_count: chainCount,
        snapshot_id: snapshot.id,
        has_custom_mamo: hasCustomMamo,
        mamo_transform: {
          has_rewards: mamoMeta.hasRewards,
          current_pending_usd: mamoMeta.currentPendingUsd,
          completed_cycles_usd: mamoMeta.completedCyclesUsd,
          daily_accrued_usd: mamoMeta.dailyAccruedUsd,
          rewards_token_symbol: mamoMeta.rewardsTokenSymbol,
        },
        snapshot_metrics: {
          total_rewards_usd: snapshotPayload.total_rewards_usd,
          total_claimed_usd: snapshotPayload.total_claimed_usd,
          total_pending_usd: snapshotPayload.total_pending_usd,
          total_claimable_usd: snapshotPayload.total_claimable_usd,
          total_claimable_token: snapshotPayload.total_claimable_token,
          rewards_token_symbol: snapshotPayload.rewards_token_symbol,
          custom_rewards_usd: customRewardsUsd,
        },
        merkl_rewards: {
          token: merklRewards?.token,
          price: merklRewards?.price,
          earned: merklRewards?.earned,
          claimed: merklRewards?.claimed,
          pending: merklRewards?.pending,
          claimable: merklRewards?.claimable,
          usd_value: merklRewards?.usd_value,
        },
        stkwell_balance: stkWellAmount,
        top_tokens: filteredTopTokens,
        top_protocols: filteredTopProtocols,
        enriched_holdings: holdingRows,
      },
      null,
      2
    )
  );
}

async function collectOneWallet(wallet) {
  const networkGroup = normalizeText(wallet.network_group);

  if (networkGroup === "qubic") {
    await collectQubicWallet(wallet);
    return;
  }

  await collectStandardWallet(wallet);
}

async function runCollector() {
  console.log(`[collector] Run started at ${new Date().toISOString()}`);

  try {
    const wallets = await fetchWallets();

    if (!wallets.length) {
      console.warn("[collector] No active wallets found in Wallets table.");
      return;
    }

    for (const wallet of wallets) {
      try {
        await collectOneWallet(wallet);
      } catch (err) {
        console.error(
          `[collector] Wallet failed: ${wallet.name || "Unnamed"} (${wallet.wallet_address})`,
          err
        );
      }
    }

    console.log(`[collector] Run finished at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[collector] Fatal run error:", err);
  }
}

runCollector();
setInterval(runCollector, POLL_INTERVAL_MS);