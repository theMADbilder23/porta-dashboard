import { createClient } from "@supabase/supabase-js";
import {
  buildDailySummary,
  getTimeframeStart,
} from "./lib/porta-math/dyf.js";

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

function formatTrendLabel(metricDate, timeframe) {
  if (!metricDate) return "";

  const date = new Date(`${metricDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return metricDate;

  if (timeframe === "weekly") {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function getStoredTimeframeSnapshot(timeframe) {
  const { data, error } = await supabase
    .from("timeframe_metric_snapshots")
    .select("*")
    .eq("timeframe", timeframe)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export default async function handler(req, res) {
  try {
    const timeframe = normalizeTimeframe(req.query?.timeframe);
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

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
        new Date(
          new Date(timeframeStart).getTime() - 48 * 60 * 60 * 1000
        ).toISOString()
      )
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) throw snapshotsError;

    const allSnapshots = Array.isArray(snapshots) ? snapshots : [];

    if (allSnapshots.length === 0) {
      return res.status(200).json([]);
    }

    if (timeframe === "daily") {
      return res
        .status(200)
        .json([buildDailySummary(allSnapshots, timeframeStart)]);
    }

    const storedTimeframe = await getStoredTimeframeSnapshot(timeframe);

    if (!storedTimeframe || !storedTimeframe.sufficient_data) {
      return res.status(200).json([]);
    }

    const windowStartDate =
      storedTimeframe.window_start_date || timeframeStart.slice(0, 10);

    const windowEndDate =
      storedTimeframe.as_of_date ||
      storedTimeframe.window_end_date ||
      new Date().toISOString().slice(0, 10);

    const { data: storedRows, error: storedRowsError } = await supabase
      .from("daily_metric_snapshots")
      .select("*")
      .gte("metric_date", windowStartDate)
      .lte("metric_date", windowEndDate)
      .order("metric_date", { ascending: true });

    if (storedRowsError) throw storedRowsError;

    const rows = Array.isArray(storedRows) ? storedRows : [];

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const trend = rows.map((row) => ({
      mode: "trend",
      snapshot_time: row.metric_time || `${row.metric_date}T00:00:00Z`,
      label: formatTrendLabel(row.metric_date, timeframe),
      metric_label: `${timeframe[0].toUpperCase()}${timeframe.slice(1)} Yield Flow`,
      total_value_usd: Number(row.total_portfolio_value || 0),
      total_claimable_usd: Number(row.total_daily_yield_flow || 0),
      total_pending_usd: Number(row.total_claimable_usd || 0),
      total_yield_flow_usd: Number(row.total_daily_yield_flow || 0),
      yield_tvd_ratio: Number(row.yield_tvd_ratio || 0),
      metric_date: row.metric_date || null,
    }));

    return res.status(200).json(trend);
  } catch (err) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: err?.message || "Unknown error",
    });
  }
}