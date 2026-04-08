import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildStoredTrend,
  buildIntradayTrend,
  buildSummary,
} from "../../../../collector/lib/porta-math/derived-metrics.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

function getMinimumRequiredRows(timeframe) {
  switch (timeframe) {
    case "weekly":
      return 5;
    case "monthly":
      return 21;
    case "quarterly":
      return 60;
    case "yearly":
      return 275;
    default:
      return 1;
  }
}

function getStartDateIso(timeframe) {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  switch (timeframe) {
    case "weekly":
      start.setUTCDate(start.getUTCDate() - 6);
      break;
    case "monthly":
      start.setUTCDate(start.getUTCDate() - 29);
      break;
    case "quarterly":
      start.setUTCDate(start.getUTCDate() - 89);
      break;
    case "yearly":
      start.setUTCDate(start.getUTCDate() - 364);
      break;
    default:
      break;
  }

  return start.toISOString().slice(0, 10);
}

function getIntradayStartIso() {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  return start.toISOString();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = normalizeTimeframe(searchParams.get("timeframe"));

    if (timeframe === "daily") {
      const intradayStartIso = getIntradayStartIso();

      const { data, error } = await supabase
        .from("intraday_metric_snapshots")
        .select("*")
        .gte("metric_time", intradayStartIso)
        .order("metric_time", { ascending: true });

      if (error) {
        return NextResponse.json(
          { error: "Failed to load intraday portfolio metrics" },
          { status: 500 }
        );
      }

      const rows = Array.isArray(data) ? data : [];

      if (!rows.length) {
        return NextResponse.json({
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

      return NextResponse.json({
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
      return NextResponse.json(
        { error: "Failed to load portfolio in-depth metrics" },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];

    if (rows.length < minimumRequiredRows) {
      return NextResponse.json({
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

    return NextResponse.json({
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
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}