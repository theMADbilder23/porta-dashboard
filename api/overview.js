import { createClient } from "@supabase/supabase-js";
import {
  safeNumber,
  capitalizeTimeframe,
  getTimeframeStart,
  getPortfolioSnapshotValue,
  buildLatestPerWallet,
  buildBucketTotals,
  splitDailyBucketTotalsForWindow,
  getMinValue,
  getMaxValue,
  getChangePctFromMin,
  getRangeFlow,
  buildDailySummary,
} from "./lib/porta-math/dyf.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDM", "DAI"]);

function normalizeTimeframe(value) {
  const timeframe = String(value || "daily").toLowerCase();

  if (
    timeframe === "daily" ||
    timeframe === "weekly" ||
    timeframe === "monthly" ||
    timeframe === "quarterly" ||
    timeframe === "yearly"
  ) {
    return timeframe;
  }

  return "daily";
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
    daily_rollover_debug: null,
  };
}

function classifyHolding({ role, tokenSymbol, category, protocol }) {
  const normalizedRole = normalizeRole(role);
  const normalizedCategory = normalizeRole(category);
  const hasProtocol = normalizeText(protocol).length > 0;

  if (normalizedRole === "swing") return "swing";

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

  const isProtocolPosition = normalizedCategory === "protocol" && hasProtocol;

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

async function getStoredTimeframeMetrics(timeframe) {
  const { data, error } = await supabase
    .from("timeframe_metric_snapshots")
    .select("*")
    .eq("timeframe", timeframe)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export default async function handler(req, res) {
  try {
    const timeframe = normalizeTimeframe(req.query?.timeframe);
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
        new Date(
          new Date(timeframeStart).getTime() - 48 * 60 * 60 * 1000
        ).toISOString()
      )
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) throw snapshotsError;

    const allSnapshots = Array.isArray(snapshots) ? snapshots : [];

    if (allSnapshots.length === 0) {
      return res.status(200).json(getEmptyResponse(timeframe));
    }

    let storedTimeframeMetrics = null;

    if (timeframe !== "daily") {
      storedTimeframeMetrics = await getStoredTimeframeMetrics(timeframe);

      if (!storedTimeframeMetrics && !hasEnoughTimeCoverage(allSnapshots, timeframe)) {
        return res.status(200).json(getEmptyResponse(timeframe));
      }
    }

    const latestPerWallet = buildLatestPerWallet(allSnapshots);
    const latestSnapshots = Array.from(latestPerWallet.values());
    const latestSnapshotIds = latestSnapshots.map((snapshot) => snapshot.id);

    const fullBucketTotals = buildBucketTotals(allSnapshots, timeframe);

    const { displayBuckets: dailyDisplayBucketTotals } =
      timeframe === "daily"
        ? splitDailyBucketTotalsForWindow(fullBucketTotals, timeframeStart)
        : { displayBuckets: fullBucketTotals };

    const bucketTotalsForStats =
      timeframe === "daily" ? dailyDisplayBucketTotals : fullBucketTotals;

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
      const claimable = safeNumber(snapshot.total_claimable_usd);

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

    let totalPortfolioValueLive = 0;
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

      totalPortfolioValueLive += portfolioValue;

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

    const portfolioBucketValues = bucketTotalsForStats.map(
      (bucket) => bucket.portfolio_total_usd ?? bucket.total_value_usd
    );

    const minPortfolioValueLive = getMinValue(portfolioBucketValues);

    let totalYieldFlow = null;
    let totalPortfolioValue = totalPortfolioValueLive;
    let totalPortfolioValueChangePct = getChangePctFromMin(
      totalPortfolioValueLive,
      minPortfolioValueLive
    );
    let passiveIncomeChangePct = null;
    let dailyRolloverDebug = null;

    if (timeframe === "daily") {
      const dailySummary = buildDailySummary(allSnapshots, timeframeStart);

      totalYieldFlow = safeNumber(dailySummary.current_yield_flow_usd);
      dailyRolloverDebug = dailySummary.daily_rollover_debug;
    } else if (storedTimeframeMetrics && storedTimeframeMetrics.sufficient_data) {
      totalYieldFlow = safeNumber(storedTimeframeMetrics.total_yield_flow_usd);
      totalPortfolioValue = safeNumber(storedTimeframeMetrics.avg_tpv);
      totalPortfolioValueChangePct = safeNumber(
        storedTimeframeMetrics.period_range_pct
      );
      passiveIncomeChangePct = safeNumber(
        storedTimeframeMetrics.period_yield_pct
      );
    } else {
      const claimableBucketValues = bucketTotalsForStats.map(
        (bucket) => bucket.claimable_total_usd ?? bucket.total_claimable_usd
      );

      const minClaimableValue = getMinValue(claimableBucketValues, {
        ignoreZero: true,
      });
      const maxClaimableValue = getMaxValue(claimableBucketValues);

      totalYieldFlow = getRangeFlow(maxClaimableValue, minClaimableValue);
    }

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
      total_portfolio_value_change_pct: totalPortfolioValueChangePct,
      passive_income_change_pct: passiveIncomeChangePct,
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
      daily_rollover_debug: timeframe === "daily" ? dailyRolloverDebug : null,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: err?.message || "Unknown error",
    });
  }
}