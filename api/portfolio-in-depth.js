import { createClient } from "@supabase/supabase-js";
import {
  normalizeTimeframe,
  getMinimumRequiredRows,
  getStartDateIso,
  getIntradayStartIso,
  buildStoredTrend,
  buildIntradayTrend,
  buildSummary,
} from "./lib/porta-math/derived-metrics.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const timeframe = normalizeTimeframe(req.query?.timeframe);

    if (timeframe === "daily") {
      const intradayStartIso = getIntradayStartIso();

      const { data, error } = await supabase
        .from("intraday_metric_snapshots")
        .select("*")
        .gte("metric_time", intradayStartIso)
        .order("metric_time", { ascending: true });

      if (error) {
        return res.status(500).json({
          error: "Failed to load intraday portfolio metrics",
        });
      }

      const rows = Array.isArray(data) ? data : [];

      if (!rows.length) {
        return res.status(200).json({
          timeframe,
          metric_label: "Portfolio In-Depth",
          sufficient_data: false,
          minimum_required_rows: 1,
          actual_rows: 0,
          summary: buildSummary([], { intraday: true, timeframe }),
          trend: [],
          rows: [],
        });
      }

      const trend = buildIntradayTrend(rows);
      const summary = buildSummary(rows, { intraday: true, timeframe });

      return res.status(200).json({
        timeframe,
        metric_label: "Portfolio In-Depth",
        sufficient_data: true,
        minimum_required_rows: 1,
        actual_rows: rows.length,
        summary,
        trend,
        rows,
      });
    }

    const startDate = getStartDateIso(timeframe);
    const minimumRequiredRows = getMinimumRequiredRows(timeframe);

    const { data, error } = await supabase
      .from("daily_metric_snapshots")
      .select("*")
      .gte("metric_date", startDate)
      .order("metric_date", { ascending: true });

    if (error) {
      return res.status(500).json({
        error: "Failed to load portfolio in-depth metrics",
      });
    }

    const rows = Array.isArray(data) ? data : [];

    if (rows.length < minimumRequiredRows) {
      return res.status(200).json({
        timeframe,
        metric_label: "Portfolio In-Depth",
        sufficient_data: false,
        minimum_required_rows: minimumRequiredRows,
        actual_rows: rows.length,
        summary: buildSummary([], { intraday: false, timeframe }),
        trend: [],
        rows: [],
      });
    }

    const trend = buildStoredTrend(rows, timeframe);
    const summary = buildSummary(rows, { intraday: false, timeframe });

    return res.status(200).json({
      timeframe,
      metric_label: "Portfolio In-Depth",
      sufficient_data: true,
      minimum_required_rows: minimumRequiredRows,
      actual_rows: rows.length,
      summary,
      trend,
      rows,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: error?.message || "Unknown error",
    });
  }
}