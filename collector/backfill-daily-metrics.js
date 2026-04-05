import { createClient } from "@supabase/supabase-js";
import {
  buildDailySummary,
  buildLatestCurrentTotals,
  safeNumber,
} from "./lib/porta-math/dyf.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAYS_BACK = 7;
const DAILY_CONTEXT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

function toDateString(date) {
  return date.toISOString().split("T")[0];
}

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

function subtractMs(date, ms) {
  return new Date(date.getTime() - ms);
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

function filterSnapshotsToDay(snapshots, dayStart, dayEnd) {
  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();

  return (snapshots || []).filter((snapshot) => {
    const ts = new Date(snapshot.snapshot_time).getTime();
    return ts >= startMs && ts <= endMs;
  });
}

async function upsertDailyMetric(row) {
  const { error } = await supabase
    .from("daily_metric_snapshots")
    .upsert(row, { onConflict: "metric_date" });

  if (error) {
    console.error("❌ Upsert error:", error);
    throw error;
  }
}

function buildDailyMetricRow({
  metricDate,
  contextSnapshots,
  displaySnapshots,
  dayStartIso,
}) {
  const summary = buildDailySummary(contextSnapshots, dayStartIso);
  const latestDisplayTotals = buildLatestCurrentTotals(displaySnapshots);

  const totalPortfolioValue = safeNumber(latestDisplayTotals.total_value_usd);
  const totalClaimableUsd = safeNumber(latestDisplayTotals.total_claimable_usd);
  const totalDailyYieldFlow = safeNumber(summary.current_yield_flow_usd);

  const minClaimableUsd = safeNumber(summary.min_total_claimable_usd);
  const avgClaimableUsd = safeNumber(summary.avg_total_claimable_usd);
  const maxClaimableUsd = safeNumber(summary.max_total_claimable_usd);

  const yieldTvdRatio =
    totalPortfolioValue > 0 ? totalDailyYieldFlow / totalPortfolioValue : 0;

  return {
    metric_date: metricDate,
    total_portfolio_value: totalPortfolioValue,
    total_claimable_usd: totalClaimableUsd,
    total_daily_yield_flow: totalDailyYieldFlow,
    min_claimable_usd: minClaimableUsd,
    avg_claimable_usd: avgClaimableUsd,
    max_claimable_usd: maxClaimableUsd,
    yield_tvd_ratio: yieldTvdRatio,
    debug_json: {
      source: "collector/backfill-daily-metrics",
      context_snapshot_count: contextSnapshots.length,
      display_snapshot_count: displaySnapshots.length,
      summary_snapshot_time: summary.snapshot_time || null,
      latest_display_snapshot_time: latestDisplayTotals.snapshot_time || null,
      metric_label: summary.metric_label || null,
      rollover_detected: Boolean(summary.daily_rollover_debug?.detected),
      rollover_snapshot_time:
        summary.daily_rollover_debug?.rollover_snapshot_time || null,
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
    },
  };
}

export async function runDailyMetrics() {
  console.log("🚀 Starting daily-metrics backfill...");

  const now = new Date();

  for (let i = DAYS_BACK; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const contextStart = subtractMs(dayStart, DAILY_CONTEXT_LOOKBACK_MS);

    console.log(`\n📅 Processing ${toDateString(date)}...`);

    const allSnapshots = await fetchSnapshots(
      contextStart.toISOString(),
      dayEnd.toISOString()
    );

    const displaySnapshots = filterSnapshotsToDay(allSnapshots, dayStart, dayEnd);

    if (!displaySnapshots.length) {
      console.log("⚠️ No same-day snapshots for day — skipping");
      continue;
    }

    const row = buildDailyMetricRow({
      metricDate: toDateString(date),
      contextSnapshots: allSnapshots,
      displaySnapshots,
      dayStartIso: dayStart.toISOString(),
    });

    await upsertDailyMetric(row);

    console.log("✅ Stored:", row.metric_date);
    console.log("   Portfolio:", row.total_portfolio_value);
    console.log("   Claimable:", row.total_claimable_usd);
    console.log("   DYF:", row.total_daily_yield_flow);
    console.log(
      "   Min/Avg/Max:",
      row.min_claimable_usd,
      row.avg_claimable_usd,
      row.max_claimable_usd
    );
    console.log(
      "   Context/Display snapshots:",
      row.debug_json.context_snapshot_count,
      "/",
      row.debug_json.display_snapshot_count
    );
  }

  console.log("\n🎉 Backfill complete");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyMetrics().catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });
}