const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDM", "DAI"]);

const ROLLOVER_PENDING_HIGH_THRESHOLD = 2.5;
const ROLLOVER_PENDING_LOW_THRESHOLD = 2.0;
const ROLLOVER_MIN_PENDING_DROP = 0.75;
const ROLLOVER_MIN_CLAIMABLE_RISE = 0.75;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSymbol(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeRole(value) {
  return normalizeText(value).toLowerCase();
}

function isStableSymbol(symbol) {
  return STABLE_SYMBOLS.has(normalizeSymbol(symbol));
}

function capitalizeTimeframe(timeframe) {
  const value = String(timeframe || "daily").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTimeframeStart(timeframe) {
  const now = new Date();

  switch ((timeframe || "daily").toLowerCase()) {
    case "weekly": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "monthly": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    case "quarterly": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    case "yearly": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    case "daily":
    default: {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d;
    }
  }
}

const MIN_TIME_SPAN_MS = {
  daily: 12 * 60 * 60 * 1000,
  weekly: 5 * 24 * 60 * 60 * 1000,
  monthly: 21 * 24 * 60 * 60 * 1000,
  quarterly: 60 * 24 * 60 * 60 * 1000,
  yearly: 275 * 24 * 60 * 60 * 1000,
};

function hasEnoughTimeCoverage(snapshots, timeframe) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return false;

  const first = new Date(snapshots[0].snapshot_time).getTime();
  const last = new Date(snapshots[snapshots.length - 1].snapshot_time).getTime();

  if (!Number.isFinite(first) || !Number.isFinite(last)) return false;

  return last - first >= (MIN_TIME_SPAN_MS[timeframe] || MIN_TIME_SPAN_MS.daily);
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

function getPortfolioSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_value_usd) + safeNumber(snapshot.total_claimable_usd);
}

function getClaimableSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_claimable_usd);
}

function getPendingSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_pending_usd);
}

function buildLatestPerWallet(snapshots) {
  const latestPerWallet = new Map();

  for (const snapshot of snapshots) {
    const existing = latestPerWallet.get(snapshot.wallet_id);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWallet.set(snapshot.wallet_id, snapshot);
    }
  }

  return latestPerWallet;
}

function buildBucketTotals(snapshots, timeframe) {
  const latestPerWalletPerBucket = new Map();

  for (const snapshot of snapshots) {
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

function isBucketLevelRollover(prevBucket, currentBucket) {
  const prevPending = safeNumber(prevBucket?.pending_total_usd);
  const currentPending = safeNumber(currentBucket?.pending_total_usd);
  const prevClaimable = safeNumber(prevBucket?.claimable_total_usd);
  const currentClaimable = safeNumber(currentBucket?.claimable_total_usd);

  const pendingDrop = prevPending - currentPending;
  const claimableRise = currentClaimable - prevClaimable;

  if (prevPending < ROLLOVER_PENDING_HIGH_THRESHOLD) return false;
  if (currentPending > ROLLOVER_PENDING_LOW_THRESHOLD) return false;
  if (pendingDrop < ROLLOVER_MIN_PENDING_DROP) return false;
  if (claimableRise < ROLLOVER_MIN_CLAIMABLE_RISE) return false;

  const tolerance = Math.max(1.25, pendingDrop * 0.75);
  return Math.abs(claimableRise - pendingDrop) <= tolerance;
}

function detectDailyRolloverMeta(bucketTotals) {
  if (!Array.isArray(bucketTotals) || bucketTotals.length < 2) return null;

  for (let i = 1; i < bucketTotals.length; i += 1) {
    const prev = bucketTotals[i - 1];
    const current = bucketTotals[i];

    if (isBucketLevelRollover(prev, current)) {
      return {
        rolloverIndex: i,
        rolloverBucket: current,
        rolloverMinClaimable: safeNumber(current.claimable_total_usd),
      };
    }
  }

  return null;
}

function getMinValue(values, { ignoreZero = false } = {}) {
  const filtered = (values || [])
    .map((v) => safeNumber(v))
    .filter((v) => (ignoreZero ? v > 0 : true));

  if (filtered.length === 0) return 0;
  return Math.min(...filtered);
}

function getMaxValue(values) {
  const filtered = (values || []).map((v) => safeNumber(v));

  if (filtered.length === 0) return 0;
  return Math.max(...filtered);
}

function getAverageValue(values, { ignoreZero = false } = {}) {
  const filtered = (values || [])
    .map((v) => safeNumber(v))
    .filter((v) => (ignoreZero ? v > 0 : true));

  if (filtered.length === 0) return 0;
  return filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
}

function getChangePctFromMin(current, min) {
  const currentValue = safeNumber(current);
  const minValue = safeNumber(min);

  if (minValue <= 0) return null;
  return (currentValue - minValue) / minValue;
}

function getRangeFlow(maxValue, minValue) {
  const max = safeNumber(maxValue);
  const min = safeNumber(minValue);
  return Math.max(0, max - min);
}

function getEmptyResponse(timeframe) {
  return {
    timeframe,
    total_portfolio_value: null,
    stable_value: null,
    rotational_value: null,
    growth_value: null,
    swing_value: null,
    realized_gains: null,
    realized_losses: null,
    passive_income: null,
    passive_income_label: `${capitalizeTimeframe(timeframe)} Yield Flow`,
    total_portfolio_value_change_pct: null,
    passive_income_change_pct: null,
    realized_gains_change_pct: null,
    realized_losses_change_pct: null,
    allocation_scope_label: "Tracked dashboard assets only",
    stable_yield_value: null,
    growth_risk_yield_value: null,
    hard_asset_yield_value: 0,
    total_value_distributed: null,
    stable_daily_yield: null,
    growth_risk_daily_yield: null,
    hard_asset_daily_yield: 0,
    total_daily_yield: null,
    stable_avg_apy: null,
    growth_risk_avg_apy: null,
    hard_asset_avg_apy: null,
    wallet_yield_debug: [],
  };
}

function classifyHolding({ role, tokenSymbol, category, protocol }) {
  const normalizedRole = normalizeRole(role);
  const normalizedCategory = normalizeRole(category);
  const hasProtocol = normalizeText(protocol).length > 0;

  if (normalizedRole === "swing") {
    return "swing";
  }

  if (
    isStableSymbol(tokenSymbol) &&
    normalizedCategory === "protocol" &&
    hasProtocol
  ) {
    return "stable";
  }

  if (normalizedRole === "yield" || normalizedRole === "hub") {
    return "growth";
  }

  if (normalizedRole === "core") {
    return "rotational";
  }

  return "growth";
}

function classifyYieldHolding({ role, tokenSymbol, category, protocol }) {
  const normalizedRole = normalizeRole(role);
  const normalizedCategory = normalizeRole(category);
  const hasProtocol = normalizeText(protocol).length > 0;
  const stableLike = isStableSymbol(tokenSymbol);

  const isProtocolPosition =
    normalizedCategory === "protocol" && hasProtocol;

  if (!isProtocolPosition) return null;

  if (normalizedRole === "core" && stableLike) {
    return "stable_yield";
  }

  if (normalizedRole === "yield" || normalizedRole === "hub") {
    return "growth_risk_yield";
  }

  return null;
}

function calculateSimpleApy(flowValue, principalValue, timeframe) {
  const flow = safeNumber(flowValue);
  const principal = safeNumber(principalValue);

  if (principal <= 0 || flow <= 0) return 0;

  const annualization = {
    daily: 365,
    weekly: 52,
    monthly: 12,
    quarterly: 4,
    yearly: 1,
  };

  return (flow * (annualization[timeframe] || 365) * 100) / principal;
}

function buildWalletYieldDebug({
  walletId,
  role,
  latestSnapshot,
  walletClaimableMin,
  walletClaimableMax,
  walletYieldFlow,
  walletStableYieldValue,
  walletGrowthRiskYieldValue,
  stableWeight,
  growthWeight,
}) {
  return {
    wallet_id: walletId,
    role,
    latest_snapshot_time: latestSnapshot?.snapshot_time ?? null,
    latest_claimable: latestSnapshot
      ? safeNumber(latestSnapshot.total_claimable_usd)
      : null,
    latest_pending: latestSnapshot
      ? safeNumber(latestSnapshot.total_pending_usd)
      : null,
    wallet_claimable_min: walletClaimableMin,
    wallet_claimable_max: walletClaimableMax,
    wallet_yield_flow: walletYieldFlow,
    wallet_stable_yield_value: walletStableYieldValue,
    wallet_growth_risk_yield_value: walletGrowthRiskYieldValue,
    stable_weight: stableWeight,
    growth_weight: growthWeight,
  };
}

module.exports = async function handler(req, res) {
  try {
    const timeframe = String(req.query.timeframe || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, role, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const walletIds = activeWallets.map((wallet) => wallet.id);

    if (walletIds.length === 0) {
      return res.status(200).json(getEmptyResponse(timeframe));
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(`
        id,
        wallet_id,
        total_value_usd,
        total_claimable_usd,
        total_claimed_usd,
        total_pending_usd,
        snapshot_time
      `)
      .in("wallet_id", walletIds)
      .gte(
        "snapshot_time",
        new Date(new Date(timeframeStart).getTime() - 48 * 60 * 60 * 1000).toISOString()
      )
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) throw snapshotsError;

    const allSnapshots = Array.isArray(snapshots) ? snapshots : [];

    if (allSnapshots.length === 0) {
      return res.status(200).json(getEmptyResponse(timeframe));
    }

    if (timeframe !== "daily" && !hasEnoughTimeCoverage(allSnapshots, timeframe)) {
      return res.status(200).json(getEmptyResponse(timeframe));
    }

    const latestPerWallet = buildLatestPerWallet(allSnapshots);
    const latestSnapshots = Array.from(latestPerWallet.values());
    const latestSnapshotIds = latestSnapshots.map((snapshot) => snapshot.id);

    const bucketTotals = buildBucketTotals(allSnapshots, timeframe);
    const rolloverMeta =
      timeframe === "daily" ? detectDailyRolloverMeta(bucketTotals) : null;

    const walletRoleMap = new Map(
      activeWallets.map((wallet) => [wallet.id, normalizeRole(wallet.role)])
    );

    let latestHoldings = [];

    if (latestSnapshotIds.length > 0) {
      const { data: holdings, error: holdingsError } = await supabase
        .from("wallet_holdings")
        .select(`
          wallet_id,
          snapshot_id,
          token_symbol,
          value_usd,
          category,
          protocol
        `)
        .in("snapshot_id", latestSnapshotIds);

      if (holdingsError) throw holdingsError;

      latestHoldings = Array.isArray(holdings) ? holdings : [];
    }

    const holdingsBySnapshotId = new Map();

    for (const holding of latestHoldings) {
      const snapshotId = holding.snapshot_id;
      if (!holdingsBySnapshotId.has(snapshotId)) {
        holdingsBySnapshotId.set(snapshotId, []);
      }
      holdingsBySnapshotId.get(snapshotId).push(holding);
    }

    const walletClaimableStats = new Map();

    for (const snapshot of allSnapshots) {
      const walletId = snapshot.wallet_id;
      const claimable = getClaimableSnapshotValue(snapshot);

      if (!walletClaimableStats.has(walletId)) {
        walletClaimableStats.set(walletId, {
          min: claimable,
          max: claimable,
        });
        continue;
      }

      const stats = walletClaimableStats.get(walletId);
      stats.min = Math.min(stats.min, claimable);
      stats.max = Math.max(stats.max, claimable);
    }

    let totalPortfolioValue = 0;
    let stableValue = 0;
    let rotationalValue = 0;
    let growthValue = 0;
    let swingValue = 0;

    let stableYieldValue = 0;
    let growthRiskYieldValue = 0;
    const hardAssetYieldValue = 0;

    const walletYieldDebug = [];

    for (const snapshot of latestSnapshots) {
      const walletId = snapshot.wallet_id;
      const role = walletRoleMap.get(walletId) || "";
      const portfolioValue = getPortfolioSnapshotValue(snapshot);

      totalPortfolioValue += portfolioValue;

      const holdings = holdingsBySnapshotId.get(snapshot.id) || [];
      let classifiedWalletValue = 0;

      let walletStableYieldValue = 0;
      let walletGrowthRiskYieldValue = 0;

      for (const holding of holdings) {
        const value = safeNumber(holding.value_usd);
        if (value <= 0) continue;

        const bucket = classifyHolding({
          role,
          tokenSymbol: holding.token_symbol,
          category: holding.category,
          protocol: holding.protocol,
        });

        classifiedWalletValue += value;

        if (bucket === "stable") stableValue += value;
        else if (bucket === "rotational") rotationalValue += value;
        else if (bucket === "growth") growthValue += value;
        else if (bucket === "swing") swingValue += value;

        const yieldBucket = classifyYieldHolding({
          role,
          tokenSymbol: holding.token_symbol,
          category: holding.category,
          protocol: holding.protocol,
        });

        if (yieldBucket === "stable_yield") {
          stableYieldValue += value;
          walletStableYieldValue += value;
        } else if (yieldBucket === "growth_risk_yield") {
          growthRiskYieldValue += value;
          walletGrowthRiskYieldValue += value;
        }
      }

      const remainder = Math.max(0, portfolioValue - classifiedWalletValue);

      if (remainder > 0) {
        const fallbackBucket = classifyHolding({
          role,
          tokenSymbol: null,
          category: null,
          protocol: null,
        });

        if (fallbackBucket === "stable") stableValue += remainder;
        else if (fallbackBucket === "rotational") rotationalValue += remainder;
        else if (fallbackBucket === "growth") growthValue += remainder;
        else if (fallbackBucket === "swing") swingValue += remainder;
      }

      const walletStats = walletClaimableStats.get(walletId) || { min: 0, max: 0 };
      const walletYieldFlow = getRangeFlow(walletStats.max, walletStats.min);
      const walletYieldBase = walletStableYieldValue + walletGrowthRiskYieldValue;

      const stableWeight =
        walletYieldBase > 0 ? walletStableYieldValue / walletYieldBase : 0;
      const growthWeight =
        walletYieldBase > 0 ? walletGrowthRiskYieldValue / walletYieldBase : 0;

      walletYieldDebug.push(
        buildWalletYieldDebug({
          walletId,
          role,
          latestSnapshot: snapshot,
          walletClaimableMin: walletStats.min,
          walletClaimableMax: walletStats.max,
          walletYieldFlow,
          walletStableYieldValue,
          walletGrowthRiskYieldValue,
          stableWeight,
          growthWeight,
        })
      );
    }

    const totalValueDistributed =
      stableYieldValue + growthRiskYieldValue + hardAssetYieldValue;

    const portfolioBucketValues = bucketTotals.map(
      (bucket) => bucket.portfolio_total_usd
    );
    const minPortfolioValue = getMinValue(portfolioBucketValues);

    const claimableBucketValues = bucketTotals.map((bucket) =>
      safeNumber(bucket.claimable_total_usd)
    );

    const postRolloverClaimables =
      timeframe === "daily" && rolloverMeta
        ? claimableBucketValues.slice(rolloverMeta.rolloverIndex)
        : claimableBucketValues;

    const resetMinClaimableValue =
      timeframe === "daily" && rolloverMeta
        ? safeNumber(rolloverMeta.rolloverMinClaimable)
        : getMinValue(claimableBucketValues, { ignoreZero: true });

    const maxClaimableValue =
      postRolloverClaimables.length > 0
        ? getMaxValue(postRolloverClaimables)
        : 0;

    const avgClaimableValue =
      postRolloverClaimables.length > 0
        ? getAverageValue(postRolloverClaimables)
        : 0;

    const totalYieldFlow =
      timeframe === "daily"
        ? getRangeFlow(maxClaimableValue, resetMinClaimableValue)
        : getRangeFlow(
            getMaxValue(claimableBucketValues),
            getMinValue(claimableBucketValues, { ignoreZero: true })
          );

    const stableFlowWeight =
      totalValueDistributed > 0 ? stableYieldValue / totalValueDistributed : 0;
    const growthFlowWeight =
      totalValueDistributed > 0 ? growthRiskYieldValue / totalValueDistributed : 0;
    const hardAssetFlowWeight =
      totalValueDistributed > 0 ? hardAssetYieldValue / totalValueDistributed : 0;

    const stableYieldFlow = totalYieldFlow * stableFlowWeight;
    const growthRiskYieldFlow = totalYieldFlow * growthFlowWeight;
    const hardAssetYieldFlow = totalYieldFlow * hardAssetFlowWeight;

    return res.status(200).json({
      timeframe,
      total_portfolio_value: totalPortfolioValue,
      stable_value: stableValue,
      rotational_value: rotationalValue,
      growth_value: growthValue,
      swing_value: swingValue,
      realized_gains: null,
      realized_losses: null,
      passive_income: totalYieldFlow,
      passive_income_label: `${capitalizeTimeframe(timeframe)} Yield Flow`,
      total_portfolio_value_change_pct: getChangePctFromMin(
        totalPortfolioValue,
        minPortfolioValue
      ),
      passive_income_change_pct:
        timeframe === "daily"
          ? getChangePctFromMin(maxClaimableValue, resetMinClaimableValue)
          : null,
      realized_gains_change_pct: null,
      realized_losses_change_pct: null,
      allocation_scope_label: "Tracked dashboard assets only",
      stable_yield_value: stableYieldValue,
      growth_risk_yield_value: growthRiskYieldValue,
      hard_asset_yield_value: hardAssetYieldValue,
      total_value_distributed: totalValueDistributed,
      stable_daily_yield: stableYieldFlow,
      growth_risk_daily_yield: growthRiskYieldFlow,
      hard_asset_daily_yield: hardAssetYieldFlow,
      total_daily_yield: totalYieldFlow,
      stable_avg_apy: calculateSimpleApy(stableYieldFlow, stableYieldValue, timeframe),
      growth_risk_avg_apy: calculateSimpleApy(
        growthRiskYieldFlow,
        growthRiskYieldValue,
        timeframe
      ),
      hard_asset_avg_apy: calculateSimpleApy(
        hardAssetYieldFlow,
        hardAssetYieldValue,
        timeframe
      ),
      wallet_yield_debug: walletYieldDebug,
      daily_rollover_debug:
        timeframe === "daily"
          ? {
              detected: Boolean(rolloverMeta),
              rollover_index: rolloverMeta?.rolloverIndex ?? null,
              rollover_snapshot_time: rolloverMeta?.rolloverBucket?.snapshot_time ?? null,
              reset_min_claimable_usd: resetMinClaimableValue,
              post_rollover_max_claimable_usd: maxClaimableValue,
              post_rollover_avg_claimable_usd: avgClaimableValue,
              post_rollover_bucket_count: postRolloverClaimables.length,
            }
          : null,
    });
  } catch (err) {
    console.error("[api/overview] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};