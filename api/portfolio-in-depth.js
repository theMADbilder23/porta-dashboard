const { createClient } = require("@supabase/supabase-js");
const {
  safeNumber,
  getTimeframeStart,
  buildLatestPerWallet,
  buildBucketTotals,
  splitDailyBucketTotalsForWindow,
  buildDailySummary,
  getAverageValue,
  getMinValue,
  getMaxValue,
  getPctChange,
} = require("./lib/porta-math/dyf");

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

function formatMetricDateLabel(metricDate, timeframe) {
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

function formatDailyBucketLabel(snapshotTime) {
  const date = new Date(snapshotTime);

  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

function buildStoredTrend(rows, timeframe) {
  return rows.map((row) => ({
    metric_date: row.metric_date,
    metric_time: null,
    label: formatMetricDateLabel(row.metric_date, timeframe),
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

function buildStoredSummary(rows) {
  if (!rows.length) {
    return {
      current: {
        metric_date: null,
        metric_time: null,
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

  const minPortfolioValue = getMinValue(portfolioValues);
  const maxPortfolioValue = getMaxValue(portfolioValues);

  const minClaimableUsd = getMinValue(claimableValues);
  const maxClaimableUsd = getMaxValue(claimableValues);

  const minDailyYieldFlow = getMinValue(dailyYieldValues);
  const maxDailyYieldFlow = getMaxValue(dailyYieldValues);

  return {
    current: {
      metric_date: latest.metric_date,
      metric_time: null,
      total_portfolio_value: safeNumber(latest.total_portfolio_value),
      total_claimable_usd: safeNumber(latest.total_claimable_usd),
      total_daily_yield_flow: safeNumber(latest.total_daily_yield_flow),
      min_claimable_usd: safeNumber(latest.min_claimable_usd),
      avg_claimable_usd: safeNumber(latest.avg_claimable_usd),
      max_claimable_usd: safeNumber(latest.max_claimable_usd),
      yield_tvd_ratio: safeNumber(latest.yield_tvd_ratio),
    },
    historical: {
      avg_portfolio_value: getAverageValue(portfolioValues),
      min_portfolio_value: minPortfolioValue,
      max_portfolio_value: maxPortfolioValue,

      avg_claimable_usd: getAverageValue(claimableValues),
      min_claimable_usd: minClaimableUsd,
      max_claimable_usd: maxClaimableUsd,

      avg_daily_yield_flow: getAverageValue(dailyYieldValues),
      min_daily_yield_flow: minDailyYieldFlow,
      max_daily_yield_flow: maxDailyYieldFlow,

      avg_yield_tvd_ratio: getAverageValue(yieldTvdRatios),
      min_yield_tvd_ratio: getMinValue(yieldTvdRatios),
      max_yield_tvd_ratio: getMaxValue(yieldTvdRatios),

      range_portfolio_pct: getPctChange(minPortfolioValue, maxPortfolioValue),
      range_claimable_pct: getPctChange(minClaimableUsd, maxClaimableUsd),
      range_daily_yield_pct: getPctChange(minDailyYieldFlow, maxDailyYieldFlow),
    },
  };
}

function buildDailyTrendFromBuckets(displayBuckets, dailySummary) {
  return displayBuckets.map((bucket) => ({
    metric_date: bucket.snapshot_time.slice(0, 10),
    metric_time: bucket.snapshot_time,
    label: formatDailyBucketLabel(bucket.snapshot_time),
    total_portfolio_value: safeNumber(bucket.total_value_usd),
    total_claimable_usd: safeNumber(bucket.total_claimable_usd),
    total_daily_yield_flow: safeNumber(dailySummary.current_yield_flow_usd),
    min_claimable_usd: safeNumber(dailySummary.min_total_claimable_usd),
    avg_claimable_usd: safeNumber(dailySummary.avg_total_claimable_usd),
    max_claimable_usd: safeNumber(dailySummary.max_total_claimable_usd),
    yield_tvd_ratio: 0,
    debug_json: {
      bucket_key: bucket.bucket_key,
      bucket_snapshot_time: bucket.snapshot_time,
      bucket_total_pending_usd: safeNumber(bucket.total_pending_usd),
      daily_rollover_debug: dailySummary.daily_rollover_debug || null,
    },
  }));
}

function buildDailySummaryResponse(trend) {
  if (!trend.length) {
    return {
      current: {
        metric_date: null,
        metric_time: null,
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

  const latest = trend[trend.length - 1];

  const portfolioValues = trend.map((row) => safeNumber(row.total_portfolio_value));
  const claimableValues = trend.map((row) => safeNumber(row.total_claimable_usd));
  const dailyYieldValues = trend.map((row) => safeNumber(row.total_daily_yield_flow));
  const yieldTvdRatios = trend.map((row) => safeNumber(row.yield_tvd_ratio));

  const minPortfolioValue = getMinValue(portfolioValues);
  const maxPortfolioValue = getMaxValue(portfolioValues);

  const minClaimableUsd = getMinValue(claimableValues);
  const maxClaimableUsd = getMaxValue(claimableValues);

  const minDailyYieldFlow = getMinValue(dailyYieldValues);
  const maxDailyYieldFlow = getMaxValue(dailyYieldValues);

  return {
    current: {
      metric_date: latest.metric_date,
      metric_time: latest.metric_time,
      total_portfolio_value: safeNumber(latest.total_portfolio_value),
      total_claimable_usd: safeNumber(latest.total_claimable_usd),
      total_daily_yield_flow: safeNumber(latest.total_daily_yield_flow),
      min_claimable_usd: safeNumber(latest.min_claimable_usd),
      avg_claimable_usd: safeNumber(latest.avg_claimable_usd),
      max_claimable_usd: safeNumber(latest.max_claimable_usd),
      yield_tvd_ratio: safeNumber(latest.yield_tvd_ratio),
    },
    historical: {
      avg_portfolio_value: getAverageValue(portfolioValues),
      min_portfolio_value: minPortfolioValue,
      max_portfolio_value: maxPortfolioValue,

      avg_claimable_usd: getAverageValue(claimableValues),
      min_claimable_usd: minClaimableUsd,
      max_claimable_usd: maxClaimableUsd,

      avg_daily_yield_flow: getAverageValue(dailyYieldValues),
      min_daily_yield_flow: minDailyYieldFlow,
      max_daily_yield_flow: maxDailyYieldFlow,

      avg_yield_tvd_ratio: getAverageValue(yieldTvdRatios),
      min_yield_tvd_ratio: getMinValue(yieldTvdRatios),
      max_yield_tvd_ratio: getMaxValue(yieldTvdRatios),

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

    if (timeframe === "daily") {
      const timeframeStartIso = getTimeframeStart("daily").toISOString();

      const { data: wallets, error: walletsError } = await supabase
        .from("Wallets")
        .select("id, is_active")
        .eq("is_active", true);

      if (walletsError) {
        console.error("[portfolio-in-depth] wallets fetch error", walletsError);
        return res.status(500).json({ error: "Failed to load active wallets" });
      }

      const walletIds = Array.isArray(wallets) ? wallets.map((wallet) => wallet.id) : [];

      if (!walletIds.length) {
        return res.status(200).json({
          timeframe,
          metric_label: "Portfolio In-Depth",
          sufficient_data: false,
          minimum_required_rows: 1,
          actual_rows: 0,
          summary: buildDailySummaryResponse([]),
          trend: [],
          rows: [],
        });
      }

      const { data: snapshots, error: snapshotsError } = await supabase
        .from("wallet_snapshots")
        .select(`
          id,
          wallet_id,
          total_value_usd,
          total_claimable_usd,
          total_claimed_usd,
          total_pending_usd,
          snapshot_time
        `)
        .in("wallet_id", walletIds)
        .gte(
          "snapshot_time",
          new Date(new Date(timeframeStartIso).getTime() - 48 * 60 * 60 * 1000).toISOString()
        )
        .order("snapshot_time", { ascending: true });

      if (snapshotsError) {
        console.error("[portfolio-in-depth] daily snapshots fetch error", snapshotsError);
        return res.status(500).json({ error: "Failed to load daily snapshot data" });
      }

      const allSnapshots = Array.isArray(snapshots) ? snapshots : [];
      const bucketTotals = buildBucketTotals(allSnapshots, "daily");
      const { displayBuckets } = splitDailyBucketTotalsForWindow(
        bucketTotals,
        timeframeStartIso
      );

      if (!displayBuckets.length) {
        return res.status(200).json({
          timeframe,
          metric_label: "Portfolio In-Depth",
          sufficient_data: false,
          minimum_required_rows: 1,
          actual_rows: 0,
          summary: buildDailySummaryResponse([]),
          trend: [],
          rows: [],
        });
      }

      const dailySummary = buildDailySummary(allSnapshots, timeframeStartIso);
      const trend = buildDailyTrendFromBuckets(displayBuckets, dailySummary);
      const summary = buildDailySummaryResponse(trend);

      return res.status(200).json({
        timeframe,
        metric_label: "Portfolio In-Depth",
        sufficient_data: true,
        minimum_required_rows: 1,
        actual_rows: trend.length,
        summary,
        trend,
        rows: trend,
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
        summary: buildStoredSummary([]),
        trend: [],
        rows: [],
      });
    }

    const summary = buildStoredSummary(rows);
    const trend = buildStoredTrend(rows, timeframe);

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