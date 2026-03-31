import { POLL_INTERVAL_MS } from "./config.js";
import { fetchWallets, insertSnapshot, insertHoldings } from "./db.js";
import { cleanWallet, isValidWallet, safeNumber } from "./utils.js";
import { collectCustomProtocols } from "./protocols/index.js";

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
} from "./sources/moonwell.js";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isMamoHolding(holding) {
  const symbol = normalizeText(holding?.token_symbol);
  const name = normalizeText(holding?.token_name);
  const protocol = normalizeText(holding?.protocol);

  return symbol === "mamo" || name.includes("mamo") || protocol === "mamo";
}

function isRewardHolding(holding) {
  return normalizeText(holding?.category) === "reward";
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

async function collectOneWallet(wallet) {
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

  const customProtocolHoldings = await collectCustomProtocols(wallet, {
    walletAddress: cleanedAddress,
    snapshotTime,
    debankData,
    merklRewards,
    stkWellAmount,
  });

  const totalWalletValue = safeNumber(debankData.totalWalletValue || 0);
  const chainCount = Array.isArray(debankData.usedChains)
    ? debankData.usedChains.length
    : 0;

  const topTokens = getTopTokens(
    debankData.allTokens,
    totalWalletValue,
    roleUsed,
    5,
    25
  );

  const topProtocols = getTopProtocols(debankData.allProtocols, 5, 25);

  const stkWellHolding = buildStkWellHolding(
    stkWellAmount,
    safeNumber(merklRewards?.price || 0),
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
    ...customProtocolHoldings,
  ];

  const customRewardHoldings = customProtocolHoldings.filter(isRewardHolding);

  const customRewardsUsd = sumRewardHoldingsUsd(customRewardHoldings);
  const customRewardsTokenAmount = sumRewardHoldingsAmount(
    customRewardHoldings,
    merklMetrics.rewards_token_symbol || null
  );

  const snapshotPayload = {
    wallet_id: wallet.id,
    total_value_usd: totalWalletValue,
    total_rewards_usd:
      safeNumber(merklMetrics.total_rewards_usd) + safeNumber(customRewardsUsd),
    total_claimed_usd: safeNumber(merklMetrics.total_claimed_usd),
    total_pending_usd:
      safeNumber(merklMetrics.total_pending_usd) + safeNumber(customRewardsUsd),
    total_claimable_usd:
      safeNumber(merklMetrics.total_claimable_usd) + safeNumber(customRewardsUsd),
    total_claimable_token:
      safeNumber(merklMetrics.total_claimable_token) +
      safeNumber(customRewardsTokenAmount),
    rewards_token_symbol: merklMetrics.rewards_token_symbol || null,
    merkl_rewards_json: merklMetrics.merkl_rewards_json || null,
    snapshot_time: snapshotTime,
  };

  const snapshot = await insertSnapshot(snapshotPayload);

  const holdingRows = allHoldings.map((holding) => ({
    snapshot_id: snapshot.id,
    wallet_id: wallet.id,
    token_symbol: holding.token_symbol,
    token_name: holding.token_name,
    network: holding.network,
    amount: holding.amount,
    value_usd: holding.value_usd,
    category: holding.category,
    protocol: holding.protocol,
    is_yield_position: holding.is_yield_position,
    snapshot_time: snapshotTime,
  }));

  await insertHoldings(holdingRows);

  console.log(
    JSON.stringify(
      {
        wallet_name: wallet.name || null,
        wallet_address: cleanedAddress,
        role_used: roleUsed,
        total_value_usd: totalWalletValue,
        chain_count: chainCount,
        snapshot_id: snapshot.id,
        has_custom_mamo: hasCustomMamo,
        snapshot_metrics: {
          total_rewards_usd: snapshotPayload.total_rewards_usd,
          total_claimed_usd: snapshotPayload.total_claimed_usd,
          total_pending_usd: snapshotPayload.total_pending_usd,
          total_claimable_usd: snapshotPayload.total_claimable_usd,
          total_claimable_token: snapshotPayload.total_claimable_token,
          rewards_token_symbol: snapshotPayload.rewards_token_symbol,
          custom_rewards_usd: customRewardsUsd,
          custom_rewards_token_amount: customRewardsTokenAmount,
        },
        merkl_rewards: {
          token: merklRewards.token,
          price: merklRewards.price,
          earned: merklRewards.earned,
          claimed: merklRewards.claimed,
          pending: merklRewards.pending,
          claimable: merklRewards.claimable,
          usd_value: merklRewards.usd_value,
        },
        stkwell_balance: stkWellAmount,
        top_tokens: filteredTopTokens,
        top_protocols: filteredTopProtocols,
        enriched_holdings: [
          ...(stkWellHolding ? [stkWellHolding] : []),
          ...customProtocolHoldings,
        ],
      },
      null,
      2
    )
  );
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