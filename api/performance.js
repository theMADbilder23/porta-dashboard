const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROLLOVER_PENDING_HIGH_THRESHOLD = 2.5;
const ROLLOVER_PENDING_LOW_THRESHOLD = 2.0;
const ROLLOVER_MIN_PENDING_DROP = 0.75;
const ROLLOVER_MIN_CLAIMABLE_RISE = 0.75;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

function makeTrendBucketLabel(bucketKey, timeframe) {
  if (timeframe === "weekly") {
    const d = new Date(`${bucketKey}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  if (timeframe === "monthly") {
    const d = new Date(`${bucketKey}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (timeframe === "quarterly") {
    const [year, month] = bucketKey.split("-");
    const d = new Date(`${year}-${month}-01T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short" });
  }

  return bucketKey;
}

function formatDailyLabel(snapshotTime) {
  const d = new Date(snapshotTime);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getPortfolioValue(snapshot) {
  return safeNumber(snapshot.total_value_usd) + safeNumber(snapshot.total_claimable_usd);
}

function getClaimableValue(snapshot) {
  return safeNumber(snapshot.total_claimable_usd);
}

function getPendingValue(snapshot) {
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

function buildLatestCurrentTotals(snapshots) {
  const latestPerWallet = buildLatestPerWallet(snapshots);

  let totalPortfolioValue = 0;
  let totalClaimableValue = 0;
  let latestSnapshotTime = null;

  for (const snapshot of latestPerWallet.values()) {
    totalPortfolioValue += getPortfolioValue(snapshot);
    totalClaimableValue += getClaimableValue(snapshot);

    if (
      !latestSnapshotTime ||
      new Date(snapshot.snapshot_time).getTime() > new Date(latestSnapshotTime).getTime()
    ) {
      latestSnapshotTime = snapshot.snapshot_time;
    }
  }

  return {
    snapshot_time: latestSnapshotTime,
    total_value_usd: totalPortfolioValue,
    total_claimable_usd: totalClaimableValue,
  };
}

function buildBucketSeries(snapshots, timeframe) {
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
        bucketKey,
        snapshot_time: snapshot.snapshot_time,
        total_value_usd: 0,
        total_claimable_usd: 0,
        total_pending_usd: 0,
      });
    }

    const bucket = bucketTotals.get(bucketKey);

    bucket.total_value_usd += getPortfolioValue(snapshot);
    bucket.total_claimable_usd += getClaimableValue(snapshot);
    bucket.total_pending_usd += getPendingValue(snapshot);

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

function getAverage(values) {
  const clean = (values || []).map((v) => safeNumber(v));
  if (clean.length === 0) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function getMin(values, { ignoreZero = false } = {}) {
  const clean = (values || [])
    .map((v) => safeNumber(v))
    .filter((v) => (ignoreZero ? v > 0 : true));

  if (clean.length === 0) return 0;
  return Math.min(...clean);
}

function getMax(values) {
  const clean = (values || []).map((v) => safeNumber(v));
  if (clean.length === 0) return 0;
  return Math.max(...clean);
}

function getPctChange(fromValue, toValue) {
  const from = safeNumber(fromValue);
  const to = safeNumber(toValue);

  if (from <= 0) return 0;
  return ((to - from) / from) * 100;
}

function getRangeFlow(maxValue, minValue) {
  const max = safeNumber(maxValue);
  const min = safeNumber(minValue);
  return Math.max(0, max - min);
}

function isBucketLevelRollover(prevBucket, currentBucket) {
  const prevPending = safeNumber(prevBucket?.total_pending_usd);
  const currentPending = safeNumber(currentBucket?.total_pending_usd);
  const prevClaimable = safeNumber(prevBucket?.total_claimable_usd);
  const currentClaimable = safeNumber(currentBucket?.total_claimable_usd);

  const pendingDrop = prevPending - currentPending;
  const claimableRise = currentClaimable - prevClaimable;

  if (prevPending < ROLLOVER_PENDING_HIGH_THRESHOLD) return false;
  if (currentPending > ROLLOVER_PENDING_LOW_THRESHOLD) return false;
  if (pendingDrop < ROLLOVER_MIN_PENDING_DROP) return false;
  if (claimableRise < ROLLOVER_MIN_CLAIMABLE_RISE) return false;

  const tolerance = Math.max(1.25, pendingDrop * 0.75);
  return Math.abs(claimableRise - pendingDrop) <= tolerance;
}

function detectDailyRolloverMeta(bucketSeries) {
  if (!Array.isArray(bucketSeries) || bucketSeries.length < 2) return null;

  for (let i = 1; i < bucketSeries.length; i += 1) {
    const prev = bucketSeries[i - 1];
    const current = bucketSeries[i];

    if (isBucketLevelRollover(prev, current)) {
      return {
        rolloverIndex: i,
        rolloverBucket: current,
        rolloverSnapshotTime: current.snapshot_time,
        rolloverClaimableUsd: safeNumber(current.total_claimable_usd),
      };
    }
  }

  return null;
}

function buildDailySummary(snapshots) {
  const bucketSeries = buildBucketSeries(snapshots, "daily");
  const currentTotals = buildLatestCurrentTotals(snapshots);
  const rolloverMeta = detectDailyRolloverMeta(bucketSeries);

  const portfolioValues = bucketSeries.map((row) =>
    safeNumber(row.total_value_usd)
  );
  const claimableValues = bucketSeries.map((row) =>
    safeNumber(row.total_claimable_usd)
  );

  const avgPortfolio = getAverage(portfolioValues);
  const minPortfolio = getMin(portfolioValues);
  const maxPortfolio = getMax(portfolioValues);

  let avgClaimable = getAverage(claimableValues);
  let minClaimable = getMin(claimableValues, { ignoreZero: true });
  let maxClaimable = getMax(claimableValues);
  let currentYieldFlow = getRangeFlow(maxClaimable, minClaimable);

  if (claimableValues.length > 0 && rolloverMeta) {
    const postRolloverClaimables = claimableValues.slice(rolloverMeta.rolloverIndex);
    const rolloverBaseline = safeNumber(rolloverMeta.rolloverClaimableUsd);

    minClaimable = rolloverBaseline;
    maxClaimable = getMax(postRolloverClaimables);
    avgClaimable = getAverage(postRolloverClaimables);
    currentYieldFlow = getRangeFlow(maxClaimable, minClaimable);
  } else if (claimableValues.length > 0) {
    minClaimable = safeNumber(claimableValues[0]);
    maxClaimable = getMax(claimableValues);
    avgClaimable = getAverage(claimableValues);
    currentYieldFlow = getRangeFlow(maxClaimable, minClaimable);
  }

  return {
    mode: "daily_summary",
    snapshot_time: currentTotals.snapshot_time,
    label: formatDailyLabel(currentTotals.snapshot_time),

    metric_label: `${capitalizeTimeframe("daily")} Yield Flow`,

    total_value_usd: currentTotals.total_value_usd,
    total_claimable_usd: currentTotals.total_claimable_usd,
    current_yield_flow_usd: currentYieldFlow,

    avg_total_value_usd: avgPortfolio,
    min_total_value_usd: minPortfolio,
    max_total_value_usd: maxPortfolio,
    range_min_to_max_total_value_pct: getPctChange(minPortfolio, maxPortfolio),
    range_current_to_max_total_value_pct: getPctChange(
      currentTotals.total_value_usd,
      maxPortfolio
    ),

    avg_total_claimable_usd: avgClaimable,
    min_total_claimable_usd: minClaimable,
    max_total_claimable_usd: maxClaimable,
    range_min_to_max_total_claimable_pct: getPctChange(minClaimable, maxClaimable),
    range_current_to_max_total_claimable_pct: getPctChange(
      maxClaimable,
      minClaimable
    ),

    snapshot_count: bucketSeries.length,
    daily_rollover_debug: {
      detected: Boolean(rolloverMeta),
      rollover_index: rolloverMeta?.rolloverIndex ?? null,
      rollover_snapshot_time: rolloverMeta?.rolloverSnapshotTime ?? null,
      rollover_claimable_usd: rolloverMeta?.rolloverClaimableUsd ?? null,
      reset_min_claimable_usd: minClaimable,
      max_post_rollover_claimable_usd: maxClaimable,
      avg_post_rollover_claimable_usd: avgClaimable,
      effective_daily_current_usd: currentYieldFlow,
    },
  };
}

module.exports = async function handler(req, res) {
  try {
    const timeframe = String(req.query.timeframe || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id")
      .eq("is_active", true);

    if (walletsError) {
      throw walletsError;
    }

    const walletIds = Array.isArray(wallets) ? wallets.map((wallet) => wallet.id) : [];

    if (walletIds.length === 0) {
      return res.status(200).json([]);
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(
        "wallet_id, snapshot_time, total_value_usd, total_claimable_usd, total_pending_usd"
      )
      .in("wallet_id", walletIds)
      .gte(
        "snapshot_time",
        new Date(new Date(timeframeStart).getTime() - 48 * 60 * 60 * 1000).toISOString()
      )
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) {
      throw snapshotsError;
    }

    const allSnapshots = Array.isArray(snapshots) ? snapshots : [];

    if (allSnapshots.length === 0) {
      return res.status(200).json([]);
    }

    if (timeframe === "daily") {
      return res.status(200).json([buildDailySummary(allSnapshots)]);
    }

    const bucketSeries = buildBucketSeries(allSnapshots, timeframe);

    const result = bucketSeries.map((row) => ({
      mode: "trend",
      snapshot_time: row.snapshot_time,
      label: makeTrendBucketLabel(row.bucketKey, timeframe),
      metric_label: `${capitalizeTimeframe(timeframe)} Yield Flow`,
      total_value_usd: row.total_value_usd,
      total_claimable_usd: row.total_claimable_usd,
      total_pending_usd: row.total_pending_usd,
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error("[api/performance] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};