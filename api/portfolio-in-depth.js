const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

function getTimeframeDays(timeframe) {
  switch (timeframe) {
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "yearly":
      return 365;
    case "daily":
    default:
      return 1;
  }
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
    case "daily":
    default:
      return 1;
  }
}

function getStartDateIso(timeframe) {
  const now = new Date();
  const days = getTimeframeDays(timeframe);

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );

  start.setUTCDate(start.getUTCDate() - (days - 1));

  return start.toISOString().split("T")[0];
}

function formatLabel(metricDate, timeframe) {
  const date = new Date(`${metricDate}T00:00:00Z`);

  if (timeframe === "daily" || timeframe === "weekly" || timeframe === "monthly") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  if (timeframe === "quarterly") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function getAverage(values) {
  const safeValues = (values || []).map(safeNumber);
  if (!safeValues.length) return 0;
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function getMin(values) {
  const safeValues = (values || []).map(safeNumber);
  if (!safeValues.length) return 0;
  return Math.min(...safeValues);
}

function getMax(values) {
  const safeValues = (values || []).map(safeNumber);
  if (!safeValues.length) return 0;
  return Math.max(...safeValues);
}

function getPctChange(fromValue, toValue) {
  const from = safeNumber(fromValue);
  const to = safeNumber(toValue);

  if (from <= 0) return 0;
  return ((to - from) / from) * 100;
}

function buildTrend(rows, timeframe) {
  return rows.map((row) => ({
    metric_date: row.metric_date,
    label: formatLabel(row.metric_date, timeframe),
    total_portfolio_value: safeNumber(row.total_portfolio_value),
    total_claimable_usd: safeNumber(row.total_claimable_usd),
    total_daily_yield_flow: safeNumber(row.total_daily_yield_flow),
    min_claimable_usd: safeNumber(row.min_claimable_usd),
    avg_claimable_usd: safeNumber(row.avg_claimable_usd),
    max_claimable_usd: safeNumber(row.max_claimable_usd),
    yield_tvd_ratio: safeNumber(row.yield_tvd_ratio),
    debug_json: row.debug_json || null,
  }));
}

function buildSummary(rows) {
  if (!rows.length) {
    return {
      current: {
        metric_date: null,
        total_portfolio_value: 0,
        total_claimable_usd: 0,
        total_daily_yield_flow: 0,
        min_claimable_usd: 0,
        avg_claimable_usd: 0,
        max_claimable_usd: 0,
        yield_tvd_ratio: 0,
      },
      historical: {
        avg_portfolio_value: 0,
        min_portfolio_value: 0,
        max_portfolio_value: 0,
        avg_claimable_usd: 0,
        min_claimable_usd: 0,
        max_claimable_usd: 0,
        avg_daily_yield_flow: 0,
        min_daily_yield_flow: 0,
        max_daily_yield_flow: 0,
        avg_yield_tvd_ratio: 0,
        min_yield_tvd_ratio: 0,
        max_yield_tvd_ratio: 0,
        range_portfolio_pct: 0,
        range_claimable_pct: 0,
        range_daily_yield_pct: 0,
      },
    };
  }

  const latest = rows[rows.length - 1];

  const portfolioValues = rows.map((row) => safeNumber(row.total_portfolio_value));
  const claimableValues = rows.map((row) => safeNumber(row.total_claimable_usd));
  const dailyYieldValues = rows.map((row) => safeNumber(row.total_daily_yield_flow));
  const yieldTvdRatios = rows.map((row) => safeNumber(row.yield_tvd_ratio));

  const minPortfolioValue = getMin(portfolioValues);
  const maxPortfolioValue = getMax(portfolioValues);

  const minClaimableUsd = getMin(claimableValues);
  const maxClaimableUsd = getMax(claimableValues);

  const minDailyYieldFlow = getMin(dailyYieldValues);
  const maxDailyYieldFlow = getMax(dailyYieldValues);

  return {
    current: {
      metric_date: latest.metric_date,
      total_portfolio_value: safeNumber(latest.total_portfolio_value),
      total_claimable_usd: safeNumber(latest.total_claimable_usd),
      total_daily_yield_flow: safeNumber(latest.total_daily_yield_flow),
      min_claimable_usd: safeNumber(latest.min_claimable_usd),
      avg_claimable_usd: safeNumber(latest.avg_claimable_usd),
      max_claimable_usd: safeNumber(latest.max_claimable_usd),
      yield_tvd_ratio: safeNumber(latest.yield_tvd_ratio),
    },
    historical: {
      avg_portfolio_value: getAverage(portfolioValues),
      min_portfolio_value: minPortfolioValue,
      max_portfolio_value: maxPortfolioValue,

      avg_claimable_usd: getAverage(claimableValues),
      min_claimable_usd: minClaimableUsd,
      max_claimable_usd: maxClaimableUsd,

      avg_daily_yield_flow: getAverage(dailyYieldValues),
      min_daily_yield_flow: minDailyYieldFlow,
      max_daily_yield_flow: maxDailyYieldFlow,

      avg_yield_tvd_ratio: getAverage(yieldTvdRatios),
      min_yield_tvd_ratio: getMin(yieldTvdRatios),
      max_yield_tvd_ratio: getMax(yieldTvdRatios),

      range_portfolio_pct: getPctChange(minPortfolioValue, maxPortfolioValue),
      range_claimable_pct: getPctChange(minClaimableUsd, maxClaimableUsd),
      range_daily_yield_pct: getPctChange(minDailyYieldFlow, maxDailyYieldFlow),
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const timeframe = normalizeTimeframe(req.query.timeframe);
    const startDate = getStartDateIso(timeframe);
    const minimumRequiredRows = getMinimumRequiredRows(timeframe);

    const { data, error } = await supabase
      .from("daily_metric_snapshots")
      .select("*")
      .gte("metric_date", startDate)
      .order("metric_date", { ascending: true });

    if (error) {
      console.error("[portfolio-in-depth] fetch error", error);
      return res.status(500).json({ error: "Failed to load portfolio in-depth metrics" });
    }

    const rows = Array.isArray(data) ? data : [];

    if (rows.length < minimumRequiredRows) {
      return res.status(200).json({
        timeframe,
        metric_label: "Portfolio In-Depth",
        sufficient_data: false,
        minimum_required_rows: minimumRequiredRows,
        actual_rows: rows.length,
        summary: buildSummary([]),
        trend: [],
        rows: [],
      });
    }

    const summary = buildSummary(rows);
    const trend = buildTrend(rows, timeframe);

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
    console.error("[portfolio-in-depth] unexpected error", error);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}