import { createClient } from "@supabase/supabase-js";
import {
  buildDailySummary,
  safeNumber,
  getPortfolioSnapshotValue,
} from "../api/lib/porta-math/dyf.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAYS_BACK = 1; // start with today only for testing

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function toBucketKey(date) {
  return new Date(date).toISOString().slice(0, 16) + ":00Z";
}

function getBucketStartTimes(dayStart) {
  const buckets = [];

  for (let i = 0; i < 48; i++) {
    const bucket = new Date(dayStart);
    bucket.setUTCMinutes(bucket.getUTCMinutes() + i * 30);
    buckets.push(bucket);
  }

  return buckets;
}

async function fetchSnapshots(startISO, endISO) {
  const { data, error } = await supabase
    .from("wallet_snapshots")
    .select("*")
    .gte("snapshot_time", startISO)
    .lte("snapshot_time", endISO)
    .order("snapshot_time", { ascending: true });

  if (error) {
    console.error("❌ Snapshot fetch error:", error);
    throw error;
  }

  return data || [];
}

function computeLatestPortfolioValue(snapshots) {
  if (!snapshots.length) return 0;

  const latestPerWallet = new Map();

  for (const snapshot of snapshots) {
    const existing = latestPerWallet.get(snapshot.wallet_id);

    if (
      !existing ||
      new Date(snapshot.snapshot_time) >
        new Date(existing.snapshot_time)
    ) {
      latestPerWallet.set(snapshot.wallet_id, snapshot);
    }
  }

  let total = 0;

  for (const snapshot of latestPerWallet.values()) {
    total += getPortfolioSnapshotValue(snapshot);
  }

  return safeNumber(total);
}

async function upsertIntradayMetric(row) {
  const { error } = await supabase
    .from("intraday_metric_snapshots")
    .upsert(row, { onConflict: "bucket_key" });

  if (error) {
    console.error("❌ Intraday upsert error:", error);
    throw error;
  }
}

async function runBackfill() {
  console.log("🚀 Starting intraday metrics backfill...");

  const now = new Date();

  for (let d = DAYS_BACK; d >= 0; d--) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - d);

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    console.log(`\n📅 Processing ${dayStart.toISOString().slice(0, 10)}...`);

    const allSnapshots = await fetchSnapshots(
      dayStart.toISOString(),
      dayEnd.toISOString()
    );

    if (!allSnapshots.length) {
      console.log("⚠️ No snapshots for day — skipping");
      continue;
    }

    const buckets = getBucketStartTimes(dayStart);

    for (const bucketTime of buckets) {
      const bucketISO = bucketTime.toISOString();

      const bucketSnapshots = allSnapshots.filter(
        (s) => new Date(s.snapshot_time) <= bucketTime
      );

      if (!bucketSnapshots.length) continue;

      const summary = buildDailySummary(
        bucketSnapshots,
        dayStart.toISOString()
      );

      const totalPortfolioValue =
        computeLatestPortfolioValue(bucketSnapshots);

      const totalClaimableUsd = safeNumber(
        summary.total_claimable_usd
      );

      const totalDailyYieldFlow = safeNumber(
        summary.current_yield_flow_usd
      );

      const minClaimableUsd = safeNumber(
        summary.min_total_claimable_usd
      );

      const avgClaimableUsd = safeNumber(
        summary.avg_total_claimable_usd
      );

      const maxClaimableUsd = safeNumber(
        summary.max_total_claimable_usd
      );

      const yieldTvdRatio =
        totalPortfolioValue > 0
          ? totalDailyYieldFlow / totalPortfolioValue
          : 0;

      const row = {
        metric_date: bucketISO.slice(0, 10),
        metric_time: bucketISO,
        bucket_key: toBucketKey(bucketISO),

        total_portfolio_value: totalPortfolioValue,
        total_claimable_usd: totalClaimableUsd,
        total_daily_yield_flow: totalDailyYieldFlow,

        min_claimable_usd: minClaimableUsd,
        avg_claimable_usd: avgClaimableUsd,
        max_claimable_usd: maxClaimableUsd,

        yield_tvd_ratio: yieldTvdRatio,

        debug_json: {
          snapshot_count: bucketSnapshots.length,
          rollover_detected:
            summary.daily_rollover_debug?.detected ?? false,
          reset_baseline_claimable_usd:
            summary.daily_rollover_debug?.reset_baseline_claimable_usd ??
            null,
          effective_daily_current_usd:
            summary.daily_rollover_debug?.effective_daily_current_usd ??
            null,
          context_bucket_count:
            summary.daily_rollover_debug?.context_bucket_count ?? null,
          display_bucket_count:
            summary.daily_rollover_debug?.display_bucket_count ?? null,
        },
      };

      await upsertIntradayMetric(row);

      console.log("✅ Bucket:", row.bucket_key);
      console.log("   DYF:", row.total_daily_yield_flow);
    }
  }

  console.log("\n🎉 Intraday backfill complete");
}

runBackfill().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});