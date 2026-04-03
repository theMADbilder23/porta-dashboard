const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROLLOVER_PENDING_HIGH_THRESHOLD = 2.5;
const ROLLOVER_PENDING_LOW_THRESHOLD = 2.0;
const ROLLOVER_MIN_PENDING_DROP = 0.75;
const ROLLOVER_MIN_CLAIMABLE_RESET_DROP = 0.35;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRoleLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "Unknown";
  return titleCaseWords(normalized);
}

function formatChainLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "Unknown";
  if (normalized === "eth") return "Ethereum";
  if (normalized === "op") return "Optimism";
  return titleCaseWords(normalized);
}

function getPortfolioSnapshotValue(snapshot) {
  return (
    safeNumber(snapshot.total_value_usd) +
    safeNumber(snapshot.total_claimable_usd)
  );
}

function getClaimableSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_claimable_usd);
}

function getPendingSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_pending_usd);
}

function buildLatestPerWallet(snapshots) {
  const latestPerWallet = new Map();

  for (const snapshot of snapshots || []) {
    const existing = latestPerWallet.get(snapshot.wallet_id);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWallet.set(snapshot.wallet_id, snapshot);
    }
  }

  return Array.from(latestPerWallet.values());
}

function getRecentWindowStart() {
  const now = new Date();
  return new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
}

function getUtcDayStartIso(value) {
  const date = new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();

  return new Date(
    Date.UTC(
      safeDate.getUTCFullYear(),
      safeDate.getUTCMonth(),
      safeDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  ).toISOString();
}

function getBucketKey(dateString, timeframe) {
  const d = new Date(dateString);

  if (timeframe === "daily") {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hour = String(d.getUTCHours()).padStart(2, "0");
    const minuteBucket = d.getUTCMinutes() < 30 ? "00" : "30";
    return `${year}-${month}-${day}T${hour}:${minuteBucket}:00Z`;
  }

  if (timeframe === "weekly" || timeframe === "monthly") {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (timeframe === "quarterly") {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  const year = d.getUTCFullYear();
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function buildBucketTotals(snapshots, timeframe) {
  const latestPerWalletPerBucket = new Map();

  for (const snapshot of snapshots || []) {
    const bucketKey = getBucketKey(snapshot.snapshot_time, timeframe);
    const compositeKey = `${bucketKey}__${snapshot.wallet_id}`;
    const existing = latestPerWalletPerBucket.get(compositeKey);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWalletPerBucket.set(compositeKey, snapshot);
    }
  }

  const bucketTotals = new Map();

  for (const [compositeKey, snapshot] of latestPerWalletPerBucket.entries()) {
    const bucketKey = compositeKey.split("__")[0];

    if (!bucketTotals.has(bucketKey)) {
      bucketTotals.set(bucketKey, {
        bucket_key: bucketKey,
        snapshot_time: snapshot.snapshot_time,
        portfolio_total_usd: 0,
        claimable_total_usd: 0,
        pending_total_usd: 0,
      });
    }

    const bucket = bucketTotals.get(bucketKey);

    bucket.portfolio_total_usd += getPortfolioSnapshotValue(snapshot);
    bucket.claimable_total_usd += getClaimableSnapshotValue(snapshot);
    bucket.pending_total_usd += getPendingSnapshotValue(snapshot);

    if (
      new Date(snapshot.snapshot_time).getTime() >
      new Date(bucket.snapshot_time).getTime()
    ) {
      bucket.snapshot_time = snapshot.snapshot_time;
    }
  }

  return Array.from(bucketTotals.values()).sort(
    (a, b) => new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime()
  );
}

function splitDailyBucketTotalsForWindow(bucketTotals, timeframeStartIso) {
  const startMs = new Date(timeframeStartIso).getTime();

  if (!Array.isArray(bucketTotals) || bucketTotals.length === 0) {
    return {
      contextBuckets: [],
      displayBuckets: [],
      displayStartIndex: -1,
    };
  }

  const displayStartIndex = bucketTotals.findIndex(
    (bucket) => new Date(bucket.snapshot_time).getTime() >= startMs
  );

  if (displayStartIndex === -1) {
    return {
      contextBuckets: bucketTotals.slice(-1),
      displayBuckets: bucketTotals.slice(-1),
      displayStartIndex: bucketTotals.length - 1,
    };
  }

  const contextStartIndex = Math.max(0, displayStartIndex - 1);

  return {
    contextBuckets: bucketTotals.slice(contextStartIndex),
    displayBuckets: bucketTotals.slice(displayStartIndex),
    displayStartIndex,
  };
}

function detectDailyRolloverMeta(bucketTotals) {
  if (!Array.isArray(bucketTotals) || bucketTotals.length < 2) return null;

  let runningMaxBeforeRollover = safeNumber(bucketTotals[0]?.claimable_total_usd);

  for (let i = 1; i < bucketTotals.length; i += 1) {
    const prev = bucketTotals[i - 1];
    const current = bucketTotals[i];

    const prevPending = safeNumber(prev.pending_total_usd);
    const currentPending = safeNumber(current.pending_total_usd);
    const pendingDrop = prevPending - currentPending;

    const currentClaimable = safeNumber(current.claimable_total_usd);
    const claimableResetDrop = runningMaxBeforeRollover - currentClaimable;

    const pendingResetDetected =
      prevPending >= ROLLOVER_PENDING_HIGH_THRESHOLD &&
      currentPending <= ROLLOVER_PENDING_LOW_THRESHOLD &&
      pendingDrop >= ROLLOVER_MIN_PENDING_DROP;

    const claimableResetDetected =
      currentPending <= ROLLOVER_PENDING_LOW_THRESHOLD &&
      claimableResetDrop >= ROLLOVER_MIN_CLAIMABLE_RESET_DROP;

    if (pendingResetDetected || claimableResetDetected) {
      return {
        rolloverIndex: i,
        rolloverSnapshotTime: current.snapshot_time,
        resetBaselineClaimableUsd: runningMaxBeforeRollover,
      };
    }

    runningMaxBeforeRollover = Math.max(
      runningMaxBeforeRollover,
      safeNumber(prev.claimable_total_usd),
      currentClaimable
    );
  }

  return null;
}

function getMaxValue(values) {
  const filtered = (values || []).map((v) => safeNumber(v));
  if (filtered.length === 0) return 0;
  return Math.max(...filtered);
}

function getRangeFlow(maxValue, minValue) {
  const max = safeNumber(maxValue);
  const min = safeNumber(minValue);
  return Math.max(0, max - min);
}

function computeGlobalDailyYieldFlow(allSnapshots, latestSnapshotTime) {
  if (!Array.isArray(allSnapshots) || allSnapshots.length === 0) {
    return 0;
  }

  const timeframeStartIso = getUtcDayStartIso(latestSnapshotTime);
  const fullBucketTotals = buildBucketTotals(allSnapshots, "daily");
  const { contextBuckets, displayBuckets } = splitDailyBucketTotalsForWindow(
    fullBucketTotals,
    timeframeStartIso
  );

  if (!displayBuckets.length) {
    return 0;
  }

  const rolloverMeta = detectDailyRolloverMeta(contextBuckets);
  const claimableBucketValues = displayBuckets.map((bucket) =>
    safeNumber(bucket.claimable_total_usd)
  );

  if (rolloverMeta) {
    const rolloverTimeMs = new Date(rolloverMeta.rolloverSnapshotTime).getTime();
    const startMs = new Date(timeframeStartIso).getTime();

    if (rolloverTimeMs >= startMs) {
      const postRolloverClaimableValues = contextBuckets
        .slice(rolloverMeta.rolloverIndex)
        .map((bucket) => safeNumber(bucket.claimable_total_usd));

      const resetSeries = [
        safeNumber(rolloverMeta.resetBaselineClaimableUsd),
        ...postRolloverClaimableValues,
      ];

      const minClaimable = safeNumber(rolloverMeta.resetBaselineClaimableUsd);
      const maxClaimable = getMaxValue(resetSeries);

      return getRangeFlow(maxClaimable, minClaimable);
    }
  }

  const minClaimable = safeNumber(claimableBucketValues[0] ?? 0);
  const maxClaimable = getMaxValue(claimableBucketValues);

  return getRangeFlow(maxClaimable, minClaimable);
}

function isRealChain(value) {
  const network = normalizeText(value);

  if (!network) return false;

  const invalidValues = new Set([
    "null",
    "undefined",
    "unknown",
    "n/a",
    "na",
    "multi-chain",
    "multichain",
    "multi chain",
  ]);

  return !invalidValues.has(network);
}

function deriveHoldingDisplayName(holding) {
  const tokenName = String(holding?.token_name || "").trim();
  const tokenSymbol = String(holding?.token_symbol || "").trim();
  const protocol = String(holding?.protocol || "").trim();

  if (tokenName) return tokenName;
  if (tokenSymbol) return tokenSymbol;
  if (protocol) return protocol;

  return "Unknown Asset";
}

function deriveHoldingPrice(holding) {
  const providedPrice = safeNumber(holding?.price_per_unit_usd);
  if (providedPrice > 0) {
    return providedPrice;
  }

  const value = safeNumber(holding?.value_usd);
  const amount = safeNumber(holding?.amount);

  if (amount > 0) {
    return value / amount;
  }

  return 0;
}

function isRewardHolding(holding) {
  return normalizeText(holding?.position_role) === "reward";
}

function buildParentMatchKeys(holding) {
  const keys = new Set();

  const tokenSymbol = normalizeText(holding?.token_symbol);
  const tokenName = normalizeText(holding?.token_name);
  const protocol = normalizeText(holding?.protocol);
  const network = normalizeText(holding?.network);

  if (protocol) keys.add(`protocol:${network}:${protocol}`);
  if (tokenSymbol) keys.add(`symbol:${network}:${tokenSymbol}`);
  if (tokenName) keys.add(`name:${network}:${tokenName}`);

  return Array.from(keys);
}

function buildRewardMatchKeys(holding) {
  const keys = new Set();

  const protocol = normalizeText(holding?.protocol);
  const network = normalizeText(holding?.network);

  if (protocol) {
    keys.add(`protocol:${network}:${protocol}`);
    keys.add(`symbol:${network}:${protocol}`);
    keys.add(`name:${network}:${protocol}`);
  }

  return Array.from(keys);
}

function normalizeRewardHolding(holding) {
  const rewardBalanceUsd = safeNumber(holding.value_usd);

  return {
    asset_id: holding.asset_id || null,
    token_symbol: String(holding.token_symbol || "").trim() || "—",
    token_name: deriveHoldingDisplayName(holding),
    network: isRealChain(holding.network)
      ? formatChainLabel(holding.network)
      : "Unknown",
    amount: safeNumber(holding.amount),
    value_usd: rewardBalanceUsd,
    reward_balance_usd: rewardBalanceUsd,
    reward_daily_usd: 0,
    price_usd: deriveHoldingPrice(holding),
    asset_class: String(holding.asset_class || "").trim() || null,
    yield_profile: String(holding.yield_profile || "").trim() || null,
    mmii_bucket: String(holding.mmii_bucket || "").trim() || null,
    mmii_subclass: String(holding.mmii_subclass || "").trim() || null,
    price_source: String(holding.price_source || "").trim() || null,
    position_role: String(holding.position_role || "").trim() || null,
    is_yield_position: Boolean(holding.is_yield_position),
    category: String(holding.category || "").trim() || null,
    protocol: String(holding.protocol || "").trim() || null,
  };
}

function normalizeParentHolding(holding, totalValue) {
  const holdingValue = safeNumber(holding.value_usd);

  return {
    asset_id: holding.asset_id || null,
    token_symbol: String(holding.token_symbol || "").trim() || "—",
    token_name: deriveHoldingDisplayName(holding),
    network: isRealChain(holding.network)
      ? formatChainLabel(holding.network)
      : "Unknown",
    amount: safeNumber(holding.amount),
    value_usd: holdingValue,
    wallet_share_pct: totalValue > 0 ? (holdingValue / totalValue) * 100 : 0,
    price_usd: deriveHoldingPrice(holding),
    yield_contribution: 0,
    asset_class: String(holding.asset_class || "").trim() || null,
    yield_profile: String(holding.yield_profile || "").trim() || null,
    mmii_bucket: String(holding.mmii_bucket || "").trim() || null,
    mmii_subclass: String(holding.mmii_subclass || "").trim() || null,
    price_source: String(holding.price_source || "").trim() || null,
    position_role: String(holding.position_role || "").trim() || null,
    is_yield_position: Boolean(holding.is_yield_position),
    category: String(holding.category || "").trim() || null,
    protocol: String(holding.protocol || "").trim() || null,
    rewards: [],
  };
}

function getParentRewardBalanceTotal(holding) {
  if (Array.isArray(holding.rewards) && holding.rewards.length > 0) {
    return holding.rewards.reduce(
      (sum, reward) =>
        sum + safeNumber(reward.reward_balance_usd ?? reward.value_usd),
      0
    );
  }

  if (normalizeText(holding.position_role) === "reward") {
    return safeNumber(holding.value_usd);
  }

  return 0;
}

function isYieldEligibleParent(holding) {
  return (
    Boolean(holding.is_yield_position) ||
    (Array.isArray(holding.rewards) && holding.rewards.length > 0) ||
    normalizeText(holding.position_role) === "reward" ||
    normalizeText(holding.yield_profile) !== "none"
  );
}

function distributeTotalByWeight(items, total, getWeight) {
  const safeTotal = safeNumber(total);

  if (!Array.isArray(items) || items.length === 0 || safeTotal <= 0) {
    return items.map(() => 0);
  }

  const weights = items.map((item) => Math.max(0, safeNumber(getWeight(item))));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  if (weightSum <= 0) {
    const equalWeight = safeTotal / items.length;
    let remaining = safeTotal;

    return items.map((_, index) => {
      const allocated = index === items.length - 1 ? remaining : equalWeight;
      remaining -= allocated;
      return Math.max(0, allocated);
    });
  }

  let remaining = safeTotal;

  return items.map((_, index) => {
    const allocated =
      index === items.length - 1
        ? remaining
        : safeTotal * (weights[index] / weightSum);

    remaining -= allocated;
    return Math.max(0, allocated);
  });
}

function groupWalletHoldings(walletHoldings, totalValue, walletClaimableContribution) {
  const principalRows = [];
  const rewardRows = [];
  const parentLookup = new Map();

  for (const holding of walletHoldings) {
    if (isRewardHolding(holding)) {
      rewardRows.push(holding);
      continue;
    }

    const normalizedParent = normalizeParentHolding(holding, totalValue);
    principalRows.push(normalizedParent);

    const keys = buildParentMatchKeys(holding);
    for (const key of keys) {
      if (!parentLookup.has(key)) {
        parentLookup.set(key, normalizedParent);
      }
    }
  }

  const unmatchedRewards = [];

  for (const reward of rewardRows) {
    const rewardKeys = buildRewardMatchKeys(reward);
    let matchedParent = null;

    for (const key of rewardKeys) {
      if (parentLookup.has(key)) {
        matchedParent = parentLookup.get(key);
        break;
      }
    }

    const normalizedReward = normalizeRewardHolding(reward);

    if (matchedParent) {
      matchedParent.rewards.push(normalizedReward);
      continue;
    }

    unmatchedRewards.push({
      ...normalizeParentHolding(reward, totalValue),
      yield_contribution: 0,
      rewards: [],
    });
  }

  const combinedRows = [...principalRows, ...unmatchedRewards];

  const eligibleParents = combinedRows.filter(isYieldEligibleParent);

  const parentClaimableAllocations = distributeTotalByWeight(
    eligibleParents,
    walletClaimableContribution,
    (holding) => {
      const rewardBalance = getParentRewardBalanceTotal(holding);
      if (rewardBalance > 0) return rewardBalance;
      return safeNumber(holding.value_usd);
    }
  );

  for (let index = 0; index < eligibleParents.length; index += 1) {
    eligibleParents[index].yield_contribution = safeNumber(
      parentClaimableAllocations[index]
    );
  }

  combinedRows.sort((a, b) => b.value_usd - a.value_usd);

  for (const holding of combinedRows) {
    if (Array.isArray(holding.rewards)) {
      holding.rewards.sort((a, b) => {
        return (
          safeNumber(b.reward_balance_usd ?? b.value_usd) -
          safeNumber(a.reward_balance_usd ?? a.value_usd)
        );
      });
    }
  }

  return combinedRows;
}

function applyCorrectRewardDailyFlow(
  accounts,
  totalBlockchainDailyYield,
  totalBlockchainClaimable
) {
  const safeDYF = safeNumber(totalBlockchainDailyYield);
  const safeTotalClaimable = safeNumber(totalBlockchainClaimable);

  if (safeDYF <= 0 || safeTotalClaimable <= 0) {
    return;
  }

  for (const account of accounts || []) {
    for (const holding of account.holdings || []) {
      if (!Array.isArray(holding.rewards) || holding.rewards.length === 0) {
        continue;
      }

      const parentClaimable = safeNumber(holding.yield_contribution);

      if (parentClaimable <= 0) continue;

      const parentShare = parentClaimable / safeTotalClaimable;

      const parentDailyUsd = safeDYF * parentShare;

      // distribute within reward streams if multiple
      const rewardWeights = holding.rewards.map((r) =>
        safeNumber(r.reward_balance_usd ?? r.value_usd)
      );

      const weightSum = rewardWeights.reduce((sum, w) => sum + w, 0);

      for (let i = 0; i < holding.rewards.length; i++) {
        const reward = holding.rewards[i];

        let rewardShare = 1;

        if (weightSum > 0) {
          rewardShare = rewardWeights[i] / weightSum;
        }

        reward.reward_daily_usd = parentDailyUsd * rewardShare;
      }

      // sort rewards by daily contribution
      holding.rewards.sort(
        (a, b) => safeNumber(b.reward_daily_usd) - safeNumber(a.reward_daily_usd)
      );
    }
  }
}

module.exports = async function handler(req, res) {
  try {
    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, name, wallet_address, role, network_group, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const walletIds = activeWallets.map((wallet) => wallet.id);

    if (walletIds.length === 0) {
      return res.status(200).json({
        total_blockchain_value: 0,
        yield_contribution: 0,
        active_accounts: 0,
        chains_covered: 0,
        accounts: [],
      });
    }

    const recentWindowStart = getRecentWindowStart();

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(`
        id,
        wallet_id,
        total_value_usd,
        total_claimable_usd,
        total_pending_usd,
        snapshot_time
      `)
      .in("wallet_id", walletIds)
      .gte("snapshot_time", recentWindowStart)
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) throw snapshotsError;

    const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];
    const latestSnapshots = buildLatestPerWallet(safeSnapshots);
    const latestSnapshotIds = latestSnapshots.map((snapshot) => snapshot.id);

    let holdings = [];

    if (latestSnapshotIds.length > 0) {
      const { data: holdingsData, error: holdingsError } = await supabase
        .from("wallet_holdings")
        .select(`
          snapshot_id,
          wallet_id,
          token_symbol,
          token_name,
          network,
          amount,
          value_usd,
          category,
          protocol,
          is_yield_position,
          asset_id,
          asset_class,
          yield_profile,
          mmii_bucket,
          mmii_subclass,
          price_source,
          price_per_unit_usd,
          position_role
        `)
        .in("snapshot_id", latestSnapshotIds);

      if (holdingsError) throw holdingsError;

      holdings = Array.isArray(holdingsData) ? holdingsData : [];
    }

    const walletById = new Map(
      activeWallets.map((wallet) => [wallet.id, wallet])
    );

    const holdingsByWalletId = new Map();

    for (const holding of holdings) {
      const walletId = holding.wallet_id;
      if (!walletId) continue;

      if (!holdingsByWalletId.has(walletId)) {
        holdingsByWalletId.set(walletId, []);
      }

      holdingsByWalletId.get(walletId).push(holding);
    }

    const totalBlockchainValue = latestSnapshots.reduce(
      (sum, snapshot) => sum + getPortfolioSnapshotValue(snapshot),
      0
    );

    const totalBlockchainClaimable = latestSnapshots.reduce(
      (sum, snapshot) => sum + getClaimableSnapshotValue(snapshot),
      0
    );

    const latestSnapshotTime = latestSnapshots.reduce((latest, snapshot) => {
      if (!latest) return snapshot.snapshot_time || null;

      return new Date(snapshot.snapshot_time).getTime() >
        new Date(latest).getTime()
        ? snapshot.snapshot_time
        : latest;
    }, null);

    const totalBlockchainDailyYield =
      latestSnapshotTime != null
        ? computeGlobalDailyYieldFlow(safeSnapshots, latestSnapshotTime)
        : 0;

    const uniqueChains = new Set();

    for (const holding of holdings) {
      const network = normalizeText(holding.network);
      if (isRealChain(network)) {
        uniqueChains.add(network);
      }
    }

    const accounts = latestSnapshots
      .map((snapshot) => {
        const wallet = walletById.get(snapshot.wallet_id);
        const walletHoldings = holdingsByWalletId.get(snapshot.wallet_id) || [];

        const chainSet = new Set();

        for (const holding of walletHoldings) {
          const network = normalizeText(holding.network);
          if (isRealChain(network)) {
            chainSet.add(formatChainLabel(network));
          }
        }

        const normalizedNetworkGroup = normalizeText(wallet?.network_group);
        if (isRealChain(normalizedNetworkGroup)) {
          chainSet.add(formatChainLabel(normalizedNetworkGroup));
        }

        const totalValue = getPortfolioSnapshotValue(snapshot);
        const walletClaimableContribution = getClaimableSnapshotValue(snapshot);

        const holdingsValueSum = walletHoldings.reduce(
          (sum, holding) => sum + safeNumber(holding.value_usd),
          0
        );

        const groupedHoldings = groupWalletHoldings(
          walletHoldings,
          totalValue,
          walletClaimableContribution
        );

        return {
          wallet_id: snapshot.wallet_id,
          wallet_name: wallet?.name || "Unknown Wallet",
          wallet_address: wallet?.wallet_address || null,
          role: formatRoleLabel(wallet?.role),
          network_group: wallet?.network_group || null,
          total_value: totalValue,
          yield_contribution: walletClaimableContribution,
          portfolio_share_pct:
            totalBlockchainValue > 0
              ? (totalValue / totalBlockchainValue) * 100
              : 0,
          snapshot_time: snapshot.snapshot_time || null,
          chains: Array.from(chainSet.values()),
          holdings_value_sum: holdingsValueSum,
          holdings_count: groupedHoldings.length,
          raw_holdings_count: walletHoldings.length,
          holdings: groupedHoldings,
        };
      })
    .sort((a, b) => b.total_value - a.total_value);

    applyCorrectRewardDailyFlow(
      accounts,
      totalBlockchainDailyYield,
      totalBlockchainClaimable
    );

    return res.status(200).json({
      total_blockchain_value: totalBlockchainValue,
      yield_contribution: totalBlockchainClaimable,
      active_accounts: latestSnapshots.length,
      chains_covered: uniqueChains.size,
      accounts,
    });
  } catch (err) {
    console.error("[api/blockchain-accounts-summary] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};