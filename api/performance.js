const { createClient } = require("@supabase/supabase-js");
const {
  capitalizeTimeframe,
  getTimeframeStart,
  getBucketKey,
  buildBucketTotals,
  buildDailySummary,
  makeTrendBucketLabel,
} = require("./lib/porta-math/dyf");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      return res.status(200).json([buildDailySummary(allSnapshots, timeframeStart)]);
    }

    const bucketSeries = buildBucketTotals(allSnapshots, timeframe);

    const result = bucketSeries.map((row) => ({
      mode: "trend",
      snapshot_time: row.snapshot_time,
      label: makeTrendBucketLabel(row.bucketKey ?? row.bucket_key ?? getBucketKey(row.snapshot_time, timeframe), timeframe),
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