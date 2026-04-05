import { createClient } from "@supabase/supabase-js";
import {
  buildDailySummary,
  safeNumber,
  getPortfolioSnapshotValue,
} from "./api/lib/porta-math/dyf.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAYS_BACK = 1;

/**
 * If current claimable drops below this share of the prior valid claimable,
 * and rollover is not confirmed, treat it as an anomaly.
 */
const CLAIMABLE_DROP_RATIO_THRESHOLD = 0.2;

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

function floorToThirtyMinuteBucket(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30);
  return d;
}

function getBucketStartTimes(dayStart, dayEnd, maxBucketTime = null) {
  const buckets = [];
  const effectiveEnd = maxBucketTime
    ? new Date(Math.min(dayEnd.getTime(), maxBucketTime.getTime()))
    : dayEnd;

  for (let i = 0; i < 48; i += 1) {
    const bucket = new Date(dayStart);
    bucket.setUTCMinutes(bucket.getUTCMinutes() + i * 30);

    if (bucket.getTime() > effectiveEnd.getTime()) {
      break;
    }

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
  if (!Array.isArray(snapshots) || snapshots.length === 0) return 0;

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

function getLatestSnapshotTime(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null;

  return snapshots.reduce((latest, snapshot) => {
    if (!latest) return snapshot.snapshot_time;

    return new Date(snapshot.snapshot_time).getTime() >
      new Date(latest).getTime()
      ? snapshot.snapshot_time
      : latest;
  }, null);
}

function shouldTreatAsClaimableAnomaly({
  priorValidRow,
  currentClaimableUsd,
  summary,
}) {
  if (!priorValidRow) return false;

  const priorClaimable = safeNumber(priorValidRow.total_claimable_usd);
  const currentClaimable = safeNumber(currentClaimableUsd);

  if (priorClaimable <= 0 || currentClaimable <= 0) return false;

  const ratio = currentClaimable / priorClaimable;

  const rolloverDetected = Boolean(summary?.daily_rollover_debug?.detected);
  const pendingResetDetected = Boolean(
    summary?.daily_rollover_debug?.pending_reset_detected
  );
  const claimableResetDetected = Boolean(
    summary?.daily_rollover_debug?.claimable_reset_detected
  );

  const hasConfirmedResetSignal =
    rolloverDetected && (pendingResetDetected || claimableResetDetected);

  return ratio < CLAIMABLE_DROP_RATIO_THRESHOLD && !hasConfirmedResetSignal;
}

function buildStoredRow({
  bucketISO,
  totalPortfolioValue,
  totalClaimableUsd,
  totalDailyYieldFlow,
  minClaimableUsd,
  avgClaimableUsd,
  maxClaimableUsd,
  yieldTvdRatio,
  debugJson,
}) {
  return {
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
    debug_json: debugJson,
  };
}

export async function runIntradayMetrics() {
  console.log("🚀 Starting intraday metrics backfill...");

  const now = new Date();

  for (let d = DAYS_BACK; d >= 0; d -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - d);

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    console.log(`\n📅 Processing ${dayStart.toISOString().slice(0, 10)}...`);

    const contextStart = new Date(dayStart);
    contextStart.setUTCDate(contextStart.getUTCDate() - 1);

    const allSnapshotsWithContext = await fetchSnapshots(
      contextStart.toISOString(),
      dayEnd.toISOString()
    );

    if (!allSnapshotsWithContext.length) {
      console.log("⚠️ No snapshots in context window — skipping");
      continue;
    }

    const daySnapshots = allSnapshotsWithContext.filter((snapshot) => {
      const snapshotMs = new Date(snapshot.snapshot_time).getTime();
      return (
        snapshotMs >= dayStart.getTime() &&
        snapshotMs <= dayEnd.getTime()
      );
    });

    if (!daySnapshots.length) {
      console.log("⚠️ No same-day snapshots — skipping");
      continue;
    }

    const latestSnapshotTime = getLatestSnapshotTime(daySnapshots);
    const latestSnapshotDate = latestSnapshotTime
      ? new Date(latestSnapshotTime)
      : null;

    const isToday =
      dayStart.toISOString().slice(0, 10) ===
      startOfDay(now).toISOString().slice(0, 10);

    const maxBucketTime =
      isToday && latestSnapshotDate
        ? floorToThirtyMinuteBucket(latestSnapshotDate)
        : dayEnd;

    const buckets = getBucketStartTimes(dayStart, dayEnd, maxBucketTime);

    let priorValidRow = null;

    for (const bucketTime of buckets) {
      const bucketISO = bucketTime.toISOString();

      const bucketSnapshotsWithContext = allSnapshotsWithContext.filter(
        (snapshot) => new Date(snapshot.snapshot_time).getTime() <= bucketTime.getTime()
      );

      const bucketSnapshotsSameDay = daySnapshots.filter(
        (snapshot) => new Date(snapshot.snapshot_time).getTime() <= bucketTime.getTime()
      );

      if (!bucketSnapshotsSameDay.length) {
        continue;
      }

      const summary = buildDailySummary(
        bucketSnapshotsWithContext,
        dayStart.toISOString()
      );

      const rawTotalPortfolioValue = computeLatestPortfolioValue(bucketSnapshotsSameDay);
      const rawTotalClaimableUsd = safeNumber(summary.total_claimable_usd);
      const rawTotalDailyYieldFlow = safeNumber(summary.current_yield_flow_usd);

      const rawMinClaimableUsd = safeNumber(summary.min_total_claimable_usd);
      const rawAvgClaimableUsd = safeNumber(summary.avg_total_claimable_usd);
      const rawMaxClaimableUsd = safeNumber(summary.max_total_claimable_usd);

      const rawYieldTvdRatio =
        rawTotalPortfolioValue > 0
          ? rawTotalDailyYieldFlow / rawTotalPortfolioValue
          : 0;

      const anomalyDetected = shouldTreatAsClaimableAnomaly({
        priorValidRow,
        currentClaimableUsd: rawTotalClaimableUsd,
        summary,
      });

      const debugJson = {
        source: "collector/backfill-intraday-metrics",
        context_snapshot_count: bucketSnapshotsWithContext.length,
        same_day_snapshot_count: bucketSnapshotsSameDay.length,
        latest_same_day_snapshot_time:
          getLatestSnapshotTime(bucketSnapshotsSameDay) || null,
        rollover_detected:
          summary.daily_rollover_debug?.detected ?? false,
        rollover_snapshot_time:
          summary.daily_rollover_debug?.rollover_snapshot_time ?? null,
        reset_baseline_claimable_usd:
          summary.daily_rollover_debug?.reset_baseline_claimable_usd ?? null,
        pending_reset_detected:
          summary.daily_rollover_debug?.pending_reset_detected ?? false,
        claimable_reset_detected:
          summary.daily_rollover_debug?.claimable_reset_detected ?? false,
        claimable_reset_drop:
          summary.daily_rollover_debug?.claimable_reset_drop ?? null,
        reset_min_claimable_usd:
          summary.daily_rollover_debug?.reset_min_claimable_usd ?? null,
        max_post_rollover_claimable_usd:
          summary.daily_rollover_debug?.max_post_rollover_claimable_usd ?? null,
        avg_post_rollover_claimable_usd:
          summary.daily_rollover_debug?.avg_post_rollover_claimable_usd ?? null,
        effective_daily_current_usd:
          summary.daily_rollover_debug?.effective_daily_current_usd ?? null,
        context_bucket_count:
          summary.daily_rollover_debug?.context_bucket_count ?? null,
        display_bucket_count:
          summary.daily_rollover_debug?.display_bucket_count ?? null,
        anomaly_filtered: anomalyDetected,
        anomaly_rule:
          anomalyDetected
            ? `claimable dropped below ${CLAIMABLE_DROP_RATIO_THRESHOLD * 100}% of prior valid claimable without confirmed rollover`
            : null,
        raw_total_claimable_usd: rawTotalClaimableUsd,
        raw_total_daily_yield_flow: rawTotalDailyYieldFlow,
        raw_min_claimable_usd: rawMinClaimableUsd,
        raw_avg_claimable_usd: rawAvgClaimableUsd,
        raw_max_claimable_usd: rawMaxClaimableUsd,
      };

      const row = anomalyDetected && priorValidRow
        ? buildStoredRow({
            bucketISO,
            totalPortfolioValue: rawTotalPortfolioValue,
            totalClaimableUsd: safeNumber(priorValidRow.total_claimable_usd),
            totalDailyYieldFlow: safeNumber(priorValidRow.total_daily_yield_flow),
            minClaimableUsd: safeNumber(priorValidRow.min_claimable_usd),
            avgClaimableUsd: safeNumber(priorValidRow.avg_claimable_usd),
            maxClaimableUsd: safeNumber(priorValidRow.max_claimable_usd),
            yieldTvdRatio:
              rawTotalPortfolioValue > 0
                ? safeNumber(priorValidRow.total_daily_yield_flow) / rawTotalPortfolioValue
                : 0,
            debugJson,
          })
        : buildStoredRow({
            bucketISO,
            totalPortfolioValue: rawTotalPortfolioValue,
            totalClaimableUsd: rawTotalClaimableUsd,
            totalDailyYieldFlow: rawTotalDailyYieldFlow,
            minClaimableUsd: rawMinClaimableUsd,
            avgClaimableUsd: rawAvgClaimableUsd,
            maxClaimableUsd: rawMaxClaimableUsd,
            yieldTvdRatio: rawYieldTvdRatio,
            debugJson,
          });

      await upsertIntradayMetric(row);

      if (!anomalyDetected) {
        priorValidRow = row;
      }

      console.log("✅ Bucket:", row.bucket_key);
      console.log("   Claimable:", row.total_claimable_usd);
      console.log("   DYF:", row.total_daily_yield_flow);
      console.log(
        "   Min/Avg/Max:",
        row.min_claimable_usd,
        row.avg_claimable_usd,
        row.max_claimable_usd
      );

      if (anomalyDetected) {
        console.log("   ⚠️ Anomaly filtered — prior valid metrics carried forward");
      }
    }
  }

  console.log("\n🎉 Intraday backfill complete");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIntradayMetrics().catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });
}