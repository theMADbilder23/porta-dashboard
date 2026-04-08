import { createClient } from "@supabase/supabase-js";
import { safeNumber } from "./lib/porta-math/dyf.js";
import {
  normalizeTimeframe,
  getMinimumRequiredRows,
  getStartDateIso,
  getAsOfDateIso,
  buildSummary,
  findStrongestWeakest,
} from "./lib/porta-math/derived-metrics.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TIMEFRAMES = ["weekly", "monthly", "quarterly", "yearly"];
const CLAIMABLE_RESET_RATIO_THRESHOLD = 0.6;
const CLAIMABLE_RESET_MIN_DROP_USD = 5;

async function fetchDailyMetricRows(timeframe) {
  const startDate = getStartDateIso(timeframe);

  const { data, error } = await supabase
    .from("daily_metric_snapshots")
    .select("*")
    .gte("metric_date", startDate)
    .order("metric_date", { ascending: true });

  if (error) {
    console.error(`[timeframe-metrics] fetch error for ${timeframe}:`, error);
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function upsertTimeframeMetric(row) {
  const { error } = await supabase
    .from("timeframe_metric_snapshots")
    .upsert(row, {
      onConflict: "timeframe,window_start_date,window_end_date,as_of_date",
    });

  if (error) {
    console.error("❌ timeframe upsert error:", error);
    throw error;
  }
}

function buildTimeframeMetricRow(timeframe, rows) {
  const minimumRequiredRows = getMinimumRequiredRows(timeframe);
  const asOfDate = getAsOfDateIso();
  const expectedWindowStartDate = getStartDateIso(timeframe);
  const sufficientData = rows.length >= minimumRequiredRows;

  const summary = buildSummary(rows, timeframe);
  const timeframeSummary = summary.timeframe_summary;
  const historical = summary.historical;
  const strongestWeakest = findStrongestWeakest(rows, timeframe);

  const actualWindowStartDate =
    rows.length > 0 ? rows[0].metric_date : expectedWindowStartDate;
  const actualWindowEndDate =
    rows.length > 0 ? rows[rows.length - 1].metric_date : asOfDate;

  return {
    timeframe: normalizeTimeframe(timeframe),
    window_start_date: actualWindowStartDate,
    window_end_date: actualWindowEndDate,
    as_of_date: asOfDate,

    avg_tpv: safeNumber(timeframeSummary.avg_tpv),
    min_tpv: safeNumber(historical.min_portfolio_value),
    max_tpv: safeNumber(historical.max_portfolio_value),

    total_yield_flow_usd: safeNumber(timeframeSummary.total_yield_flow_usd),
    avg_yield_flow_usd: safeNumber(historical.avg_daily_yield_flow),
    min_yield_flow_usd: safeNumber(historical.min_daily_yield_flow),
    max_yield_flow_usd: safeNumber(historical.max_daily_yield_flow),

    total_claimable_usd: safeNumber(timeframeSummary.total_claimable_usd),
    locked_claimable_usd: safeNumber(timeframeSummary.locked_claimable_usd),
    active_claimable_usd: safeNumber(timeframeSummary.active_claimable_usd),
    claimable_reset_count: Number(timeframeSummary.claimable_reset_count || 0),

    period_yield_ratio: safeNumber(timeframeSummary.period_yield_ratio),
    period_yield_pct: safeNumber(timeframeSummary.period_yield_pct),
    period_range_pct: safeNumber(historical.range_portfolio_pct),

    strongest_period_label: strongestWeakest.strongest_period_label,
    strongest_period_value: strongestWeakest.strongest_period_value,
    weakest_period_label: strongestWeakest.weakest_period_label,
    weakest_period_value: strongestWeakest.weakest_period_value,

    source_row_count: rows.length,
    minimum_required_rows: minimumRequiredRows,
    sufficient_data: sufficientData,

    summary_json: {
      source: "collector/backfill-timeframe-metrics",
      timeframe,
      summary,
    },

    debug_json: {
      source: "collector/backfill-timeframe-metrics",
      timeframe,
      row_count: rows.length,
      minimum_required_rows: minimumRequiredRows,
      sufficient_data: sufficientData,
      expected_window_start_date: expectedWindowStartDate,
      actual_window_start_date: actualWindowStartDate,
      actual_window_end_date: actualWindowEndDate,
      latest_metric_date: timeframeSummary.latest_metric_date || null,
      claimable_reset_count: timeframeSummary.claimable_reset_count || 0,
      claimable_reset_points: timeframeSummary.claimable_reset_points || [],
      header_labels: timeframeSummary.header_labels || null,
    },
  };
}

export async function runTimeframeMetrics() {
  console.log("🚀 Starting timeframe metric backfill...");

  for (const timeframe of TIMEFRAMES) {
    console.log(`\n📦 Processing ${timeframe}...`);

    const rows = await fetchDailyMetricRows(timeframe);
    const row = buildTimeframeMetricRow(timeframe, rows);

    await upsertTimeframeMetric(row);

    console.log(`✅ Stored ${timeframe}`);
    console.log("   Window:", row.window_start_date, "→", row.window_end_date);
    console.log("   Avg TPV:", row.avg_tpv);
    console.log("   Total YF:", row.total_yield_flow_usd);
    console.log("   Yield %:", row.period_yield_pct);
    console.log("   Sufficient:", row.sufficient_data);
    console.log("   Source rows:", row.source_row_count);
  }

  console.log("\n🎉 Timeframe metric backfill complete");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTimeframeMetrics().catch((err) => {
    console.error("❌ Fatal timeframe metric error:", err);
    process.exit(1);
  });
}