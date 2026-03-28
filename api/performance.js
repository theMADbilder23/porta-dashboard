const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

function getTrendBucketKey(dateString, timeframe) {
  const d = new Date(dateString);

  switch (timeframe) {
    case "weekly": {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    case "monthly": {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    case "quarterly": {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      return `${yyyy}-${mm}`;
    }
    case "yearly":
    default: {
      const yyyy = d.getUTCFullYear();
      const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
      return `${yyyy}-Q${quarter}`;
    }
  }
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

function getPercentChange(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function getStdDev(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function formatDailyLabel(snapshotTime) {
  const d = new Date(snapshotTime);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getThirtyMinuteBucket(dateString) {
  const d = new Date(dateString);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const minuteBucket = d.getUTCMinutes() < 30 ? "00" : "30";
  return `${year}-${month}-${day}T${hour}:${minuteBucket}:00Z`;
}

function buildDailyBucketSeries(snapshots) {
  const latestPerWalletPerBucket = new Map();

  for (const snapshot of snapshots) {
    const bucket = getThirtyMinuteBucket(snapshot.snapshot_time);
    const compositeKey = `${bucket}__${snapshot.wallet_id}`;
    const existing = latestPerWalletPerBucket.get(compositeKey);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWalletPerBucket.set(compositeKey, {
        bucket,
        wallet_id: snapshot.wallet_id,
        snapshot_time: snapshot.snapshot_time,
        total_value_usd: safeNumber(snapshot.total_value_usd),
        total_claimable_usd: safeNumber(snapshot.total_claimable_usd),
      });
    }
  }

  const bucketTotals = new Map();

  for (const entry of latestPerWalletPerBucket.values()) {
    if (!bucketTotals.has(entry.bucket)) {
      bucketTotals.set(entry.bucket, {
        snapshot_time: entry.bucket,
        total_value_usd: 0,
        total_claimable_usd: 0,
      });
    }

    const bucket = bucketTotals.get(entry.bucket);
    bucket.total_value_usd += entry.total_value_usd;
    bucket.total_claimable_usd += entry.total_claimable_usd;
  }

  return Array.from(bucketTotals.values()).sort(
    (a, b) => new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime()
  );
}

function buildLatestCurrentTotals(snapshots) {
  const latestPerWallet = new Map();

  for (const snapshot of snapshots) {
    const existing = latestPerWallet.get(snapshot.wallet_id);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWallet.set(snapshot.wallet_id, {
        wallet_id: snapshot.wallet_id,
        snapshot_time: snapshot.snapshot_time,
        total_value_usd: safeNumber(snapshot.total_value_usd),
        total_claimable_usd: safeNumber(snapshot.total_claimable_usd),
      });
    }
  }

  let total_value_usd = 0;
  let total_claimable_usd = 0;
  let latest_snapshot_time = null;

  for (const row of latestPerWallet.values()) {
    total_value_usd += row.total_value_usd;
    total_claimable_usd += row.total_claimable_usd;

    if (
      !latest_snapshot_time ||
      new Date(row.snapshot_time).getTime() > new Date(latest_snapshot_time).getTime()
    ) {
      latest_snapshot_time = row.snapshot_time;
    }
  }

  return {
    snapshot_time: latest_snapshot_time,
    total_value_usd,
    total_claimable_usd,
  };
}

function buildDailySummary(snapshots) {
  const bucketSeries = buildDailyBucketSeries(snapshots);
  const currentTotals = buildLatestCurrentTotals(snapshots);

  const portfolioValues = bucketSeries.map((p) => safeNumber(p.total_value_usd));
  const passiveValues = bucketSeries.map((p) => safeNumber(p.total_claimable_usd));

  const firstPortfolio = portfolioValues[0] || 0;
  const firstPassive = passiveValues[0] || 0;

  const avgPortfolio =
    portfolioValues.length > 0
      ? portfolioValues.reduce((sum, v) => sum + v, 0) / portfolioValues.length
      : 0;

  const avgPassive =
    passiveValues.length > 0
      ? passiveValues.reduce((sum, v) => sum + v, 0) / passiveValues.length
      : 0;

  const portfolioPctChanges = [];
  const passivePctChanges = [];

  for (let i = 1; i < portfolioValues.length; i += 1) {
    portfolioPctChanges.push(
      getPercentChange(portfolioValues[i], portfolioValues[i - 1])
    );
  }

  for (let i = 1; i < passiveValues.length; i += 1) {
    passivePctChanges.push(
      getPercentChange(passiveValues[i], passiveValues[i - 1])
    );
  }

  const avgPortfolioPctChange =
    portfolioPctChanges.length > 0
      ? portfolioPctChanges.reduce((sum, v) => sum + v, 0) / portfolioPctChanges.length
      : 0;

  const avgPassivePctChange =
    passivePctChanges.length > 0
      ? passivePctChanges.reduce((sum, v) => sum + v, 0) / passivePctChanges.length
      : 0;

  return {
    mode: "daily_summary",
    snapshot_time: currentTotals.snapshot_time,
    label: formatDailyLabel(currentTotals.snapshot_time),

    total_value_usd: currentTotals.total_value_usd,
    total_claimable_usd: currentTotals.total_claimable_usd,

    avg_total_value_usd: avgPortfolio,
    min_total_value_usd: portfolioValues.length ? Math.min(...portfolioValues) : 0,
    max_total_value_usd: portfolioValues.length ? Math.max(...portfolioValues) : 0,
    net_change_total_value_usd: currentTotals.total_value_usd - firstPortfolio,
    avg_change_total_value_pct: avgPortfolioPctChange,
    volatility_total_value_usd: getStdDev(portfolioValues),

    avg_total_claimable_usd: avgPassive,
    min_total_claimable_usd: (() => {
      const nonZeroPassiveValues = passiveValues.filter((v) => v > 0);
      return nonZeroPassiveValues.length ? Math.min(...nonZeroPassiveValues) : 0;
    })(),
    max_total_claimable_usd: passiveValues.length ? Math.max(...passiveValues) : 0,
    net_change_total_claimable_usd: currentTotals.total_claimable_usd - firstPassive,
    avg_change_total_claimable_pct: avgPassivePctChange,
    volatility_total_claimable_usd: getStdDev(passiveValues),

    snapshot_count: bucketSeries.length,
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

    const walletIds = Array.isArray(wallets) ? wallets.map((w) => w.id) : [];

    if (walletIds.length === 0) {
      return res.status(200).json([]);
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select("wallet_id, snapshot_time, total_value_usd, total_claimable_usd")
      .in("wallet_id", walletIds)
      .gte("snapshot_time", timeframeStart)
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) {
      throw snapshotsError;
    }

    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      return res.status(200).json([]);
    }

    if (timeframe === "daily") {
      const dailySummary = buildDailySummary(snapshots);
      return res.status(200).json([dailySummary]);
    }

    const latestPerWalletPerBucket = new Map();

    for (const snapshot of snapshots) {
      const bucketKey = getTrendBucketKey(snapshot.snapshot_time, timeframe);
      const compositeKey = `${bucketKey}__${snapshot.wallet_id}`;
      const existing = latestPerWalletPerBucket.get(compositeKey);

      if (
        !existing ||
        new Date(snapshot.snapshot_time).getTime() >
          new Date(existing.snapshot_time).getTime()
      ) {
        latestPerWalletPerBucket.set(compositeKey, {
          bucketKey,
          wallet_id: snapshot.wallet_id,
          snapshot_time: snapshot.snapshot_time,
          total_value_usd: safeNumber(snapshot.total_value_usd),
          total_claimable_usd: safeNumber(snapshot.total_claimable_usd),
        });
      }
    }

    const bucketTotals = new Map();

    for (const entry of latestPerWalletPerBucket.values()) {
      if (!bucketTotals.has(entry.bucketKey)) {
        bucketTotals.set(entry.bucketKey, {
          bucketKey: entry.bucketKey,
          snapshot_time: entry.snapshot_time,
          total_value_usd: 0,
          total_claimable_usd: 0,
        });
      }

      const bucket = bucketTotals.get(entry.bucketKey);
      bucket.total_value_usd += entry.total_value_usd;
      bucket.total_claimable_usd += entry.total_claimable_usd;

      if (
        new Date(entry.snapshot_time).getTime() >
        new Date(bucket.snapshot_time).getTime()
      ) {
        bucket.snapshot_time = entry.snapshot_time;
      }
    }

    const result = Array.from(bucketTotals.values())
      .sort(
        (a, b) =>
          new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime()
      )
      .map((bucket) => ({
        mode: "trend",
        snapshot_time: bucket.snapshot_time,
        label: makeTrendBucketLabel(bucket.bucketKey, timeframe),
        total_value_usd: bucket.total_value_usd,
        total_claimable_usd: bucket.total_claimable_usd,
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