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

function formatTrendLabel(metricDate, metricTime, timeframe) {
  if (timeframe === "weekly" && metricTime) {
    const date = new Date(metricTime);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
      });
    }
  }

  if (!metricDate) return "";

  const date = new Date(`${metricDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return metricDate;

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

    const walletIds = Array.isArray(wallets)
      ? wallets.map((wallet) => wallet.id)
      : [];

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

    if (timeframe === "weekly") {
      const intradayWindowStartIso = `${windowStartDate}T00:00:00Z`;
      const intradayWindowEndIso = `${windowEndDate}T23:59:59.999Z`;

      const { data: intradayRows, error: intradayRowsError } = await supabase
        .from("intraday_metric_snapshots")
        .select("*")
        .gte("metric_time", intradayWindowStartIso)
        .lte("metric_time", intradayWindowEndIso)
        .order("metric_time", { ascending: true });

      if (intradayRowsError) throw intradayRowsError;

      const rows = Array.isArray(intradayRows) ? intradayRows : [];

      if (rows.length === 0) {
        return res.status(200).json([]);
      }

      const trend = rows.map((row) => ({
        mode: "trend",
        snapshot_time: row.metric_time || `${row.metric_date}T00:00:00Z`,
        label: formatTrendLabel(row.metric_date, row.metric_time, timeframe),
        metric_label: "Weekly Yield Flow",
        total_value_usd: Number(row.total_portfolio_value || 0),
        total_claimable_usd: Number(row.total_claimable_usd || 0),
        total_pending_usd: Number(row.total_pending_usd || 0),
        total_yield_flow_usd: Number(row.total_daily_yield_flow || 0),
        yield_tvd_ratio: Number(row.yield_tvd_ratio || 0),
        metric_date: row.metric_date || null,
        metric_time: row.metric_time || null,
      }));

      return res.status(200).json(trend);
    }

    const { data: dailyRows, error: dailyRowsError } = await supabase
      .from("daily_metric_snapshots")
      .select("*")
      .gte("metric_date", windowStartDate)
      .lte("metric_date", windowEndDate)
      .order("metric_date", { ascending: true });

    if (dailyRowsError) throw dailyRowsError;

    const rows = Array.isArray(dailyRows) ? dailyRows : [];

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const trend = rows.map((row) => ({
      mode: "trend",
      snapshot_time: row.metric_time || `${row.metric_date}T00:00:00Z`,
      label: formatTrendLabel(row.metric_date, row.metric_time, timeframe),
      metric_label: `${timeframe[0].toUpperCase()}${timeframe.slice(1)} Yield Flow`,
      total_value_usd: Number(row.total_portfolio_value || 0),
      total_claimable_usd: Number(row.total_claimable_usd || 0),
      total_pending_usd: Number(row.total_pending_usd || 0),
      total_yield_flow_usd: Number(row.total_daily_yield_flow || 0),
      yield_tvd_ratio: Number(row.yield_tvd_ratio || 0),
      metric_date: row.metric_date || null,
      metric_time: row.metric_time || null,
    }));

    return res.status(200).json(trend);
  } catch (err) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: err?.message || "Unknown error",
    });
  }
}