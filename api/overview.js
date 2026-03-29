const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDM", "DAI"]);

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

function getYieldFlowBasis(snapshot) {
  return (
    safeNumber(snapshot.total_claimable_usd) +
    safeNumber(snapshot.total_claimed_usd) +
    safeNumber(snapshot.total_pending_usd)
  );
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

function getStartOfCurrentUtcDay() {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
}

function buildPreviousDayClosePerWallet(snapshots) {
  const grouped = new Map();
  const startOfTodayMs = getStartOfCurrentUtcDay().getTime();

  for (const snapshot of snapshots) {
    if (!grouped.has(snapshot.wallet_id)) {
      grouped.set(snapshot.wallet_id, []);
    }
    grouped.get(snapshot.wallet_id).push(snapshot);
  }

  const previousDayClosePerWallet = new Map();

  for (const [walletId, walletSnapshots] of grouped.entries()) {
    const eligibleSnapshots = walletSnapshots
      .filter(
        (snapshot) => new Date(snapshot.snapshot_time).getTime() < startOfTodayMs
      )
      .sort(
        (a, b) =>
          new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime()
      );

    if (eligibleSnapshots.length > 0) {
      previousDayClosePerWallet.set(
        walletId,
        eligibleSnapshots[eligibleSnapshots.length - 1]
      );
    }
  }

  return previousDayClosePerWallet;
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
        portfolio_total_usd: 0,
        claimable_total_usd: 0,
        yield_flow_total_usd: 0,
      });
    }

    const bucket = bucketTotals.get(bucketKey);
    bucket.portfolio_total_usd += getPortfolioSnapshotValue(snapshot);
    bucket.claimable_total_usd += getClaimableSnapshotValue(snapshot);
    bucket.yield_flow_total_usd += getYieldFlowBasis(snapshot);
  }

  return Array.from(bucketTotals.values()).sort((a, b) =>
    a.bucket_key.localeCompare(b.bucket_key)
  );
}

function getMinValue(values, { ignoreZero = false } = {}) {
  const filtered = (values || [])
    .map((v) => safeNumber(v))
    .filter((v) => (ignoreZero ? v > 0 : true));

  if (filtered.length === 0) return 0;
  return Math.min(...filtered);
}

function getChangePctFromMin(current, min) {
  const currentValue = safeNumber(current);
  const minValue = safeNumber(min);

  if (minValue <= 0) return null;
  return (currentValue - minValue) / minValue;
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

function calculateDailyYieldFromPreviousDayClose(currentSnapshot, previousDayCloseSnapshot) {
  if (!currentSnapshot || !previousDayCloseSnapshot) return 0;

  const currentFlow = getYieldFlowBasis(currentSnapshot);
  const previousDayCloseFlow = getYieldFlowBasis(previousDayCloseSnapshot);

  return Math.max(0, currentFlow - previousDayCloseFlow);
}

function calculateSimpleApy(dailyYield, principalValue) {
  const daily = safeNumber(dailyYield);
  const principal = safeNumber(principalValue);

  if (principal <= 0) return 0;
  return (daily * 365 * 100) / principal;
}

function buildWalletYieldDebug({
  walletId,
  role,
  latestSnapshot,
  previousDayCloseSnapshot,
  walletDailyYield,
  walletStableYieldValue,
  walletGrowthRiskYieldValue,
}) {
  return {
    wallet_id: walletId,
    role,
    latest_snapshot_time: latestSnapshot?.snapshot_time ?? null,
    previous_day_close_snapshot_time:
      previousDayCloseSnapshot?.snapshot_time ?? null,
    latest_flow_basis: latestSnapshot ? getYieldFlowBasis(latestSnapshot) : null,
    previous_day_close_flow_basis: previousDayCloseSnapshot
      ? getYieldFlowBasis(previousDayCloseSnapshot)
      : null,
    wallet_daily_yield: walletDailyYield,
    wallet_stable_yield_value: walletStableYieldValue,
    wallet_growth_risk_yield_value: walletGrowthRiskYieldValue,
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
    const previousDayClosePerWallet = buildPreviousDayClosePerWallet(allSnapshots);
    const latestSnapshots = Array.from(latestPerWallet.values());
    const latestSnapshotIds = latestSnapshots.map((snapshot) => snapshot.id);

    const bucketTotals = buildBucketTotals(allSnapshots, timeframe);

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

    let totalPortfolioValue = 0;
    let passiveIncome = 0;

    let stableValue = 0;
    let rotationalValue = 0;
    let growthValue = 0;
    let swingValue = 0;

    let stableYieldValue = 0;
    let growthRiskYieldValue = 0;
    const hardAssetYieldValue = 0;

    let stableDailyYield = 0;
    let growthRiskDailyYield = 0;
    const hardAssetDailyYield = 0;

    const walletYieldDebug = [];

    for (const snapshot of latestSnapshots) {
      const walletId = snapshot.wallet_id;
      const role = walletRoleMap.get(walletId) || "";
      const portfolioValue = getPortfolioSnapshotValue(snapshot);

      const previousDayCloseSnapshot = previousDayClosePerWallet.get(walletId);
      const walletDailyYield = calculateDailyYieldFromPreviousDayClose(
        snapshot,
        previousDayCloseSnapshot
      );

      totalPortfolioValue += portfolioValue;
      passiveIncome += walletDailyYield;

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

      const walletYieldBase = walletStableYieldValue + walletGrowthRiskYieldValue;

      if (walletYieldBase > 0 && walletDailyYield > 0) {
        const stableWeight = walletStableYieldValue / walletYieldBase;
        const growthWeight = walletGrowthRiskYieldValue / walletYieldBase;

        stableDailyYield += walletDailyYield * stableWeight;
        growthRiskDailyYield += walletDailyYield * growthWeight;
      }

      walletYieldDebug.push(
        buildWalletYieldDebug({
          walletId,
          role,
          latestSnapshot: snapshot,
          previousDayCloseSnapshot,
          walletDailyYield,
          walletStableYieldValue,
          walletGrowthRiskYieldValue,
        })
      );
    }

    const totalDailyYield =
      stableDailyYield + growthRiskDailyYield + hardAssetDailyYield;

    const totalValueDistributed =
      stableYieldValue + growthRiskYieldValue + hardAssetYieldValue;

    const portfolioBucketValues = bucketTotals.map((bucket) => bucket.portfolio_total_usd);
    const yieldFlowBucketValues = bucketTotals.map((bucket) => bucket.yield_flow_total_usd);

    const minPortfolioValue = getMinValue(portfolioBucketValues);
    const minPassiveIncome = getMinValue(yieldFlowBucketValues, { ignoreZero: true });

    return res.status(200).json({
      timeframe,
      total_portfolio_value: totalPortfolioValue,
      stable_value: stableValue,
      rotational_value: rotationalValue,
      growth_value: growthValue,
      swing_value: swingValue,
      realized_gains: null,
      realized_losses: null,
      passive_income: totalDailyYield,
      total_portfolio_value_change_pct: getChangePctFromMin(
        totalPortfolioValue,
        minPortfolioValue
      ),
      passive_income_change_pct: getChangePctFromMin(
        totalDailyYield,
        minPassiveIncome
      ),
      realized_gains_change_pct: null,
      realized_losses_change_pct: null,
      allocation_scope_label: "Tracked dashboard assets only",
      stable_yield_value: stableYieldValue,
      growth_risk_yield_value: growthRiskYieldValue,
      hard_asset_yield_value: hardAssetYieldValue,
      total_value_distributed: totalValueDistributed,
      stable_daily_yield: stableDailyYield,
      growth_risk_daily_yield: growthRiskDailyYield,
      hard_asset_daily_yield: hardAssetDailyYield,
      total_daily_yield: totalDailyYield,
      stable_avg_apy: calculateSimpleApy(stableDailyYield, stableYieldValue),
      growth_risk_avg_apy: calculateSimpleApy(
        growthRiskDailyYield,
        growthRiskYieldValue
      ),
      hard_asset_avg_apy: calculateSimpleApy(
        hardAssetDailyYield,
        hardAssetYieldValue
      ),
      wallet_yield_debug: walletYieldDebug,
    });
  } catch (err) {
    console.error("[api/overview] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};