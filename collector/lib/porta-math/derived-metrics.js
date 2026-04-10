import {
  safeNumber,
  getAverageValue,
  getMinValue,
  getMaxValue,
  getPctChange,
} from "./dyf.js";

const CLAIMABLE_RESET_RATIO_THRESHOLD = 0.6;
const CLAIMABLE_RESET_MIN_DROP_USD = 5;

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
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  start.setUTCDate(start.getUTCDate() - (days - 1));

  return start.toISOString().split("T")[0];
}

function getIntradayStartIso() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  ).toISOString();
}

function getAsOfDateIso() {
  return new Date().toISOString().split("T")[0];
}

function formatMetricDateLabel(metricDate, timeframe) {
  const date = new Date(`${metricDate}T00:00:00Z`);

  if (!Number.isFinite(date.getTime())) return "—";

  if (
    timeframe === "daily" ||
    timeframe === "weekly" ||
    timeframe === "monthly"
  ) {
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

function formatDailyBucketLabel(metricTime) {
  const date = new Date(metricTime);

  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

function getYieldFlowPrefix(timeframe) {
  switch (timeframe) {
    case "weekly":
      return "WYF";
    case "monthly":
      return "MYF";
    case "quarterly":
      return "QYF";
    case "yearly":
      return "YYF";
    case "daily":
    default:
      return "DYF";
  }
}

function getPeriodYieldLabel(timeframe) {
  switch (timeframe) {
    case "weekly":
      return "Weekly Yield %";
    case "monthly":
      return "Monthly Yield %";
    case "quarterly":
      return "Quarterly Yield %";
    case "yearly":
      return "Yearly Yield %";
    case "daily":
    default:
      return "Yield / TVD";
  }
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

function buildIntradayTrend(rows) {
  return rows.map((row) => ({
    metric_date: row.metric_date,
    metric_time: row.metric_time,
    label: formatDailyBucketLabel(row.metric_time),
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

function shouldTreatAsClaimableReset(previousRow, currentRow) {
  if (!previousRow || !currentRow) return false;

  const previousClaimable = safeNumber(previousRow.total_claimable_usd);
  const currentClaimable = safeNumber(currentRow.total_claimable_usd);

  if (previousClaimable <= 0) return false;

  const dropUsd = previousClaimable - currentClaimable;
  const ratio = currentClaimable / previousClaimable;

  return (
    dropUsd >= CLAIMABLE_RESET_MIN_DROP_USD &&
    ratio <= CLAIMABLE_RESET_RATIO_THRESHOLD
  );
}

function buildResetAwareTotalClaimable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      total_claimable_usd: 0,
      locked_claimable_usd: 0,
      active_claimable_usd: 0,
      reset_count: 0,
      reset_points: [],
    };
  }

  let lockedClaimableUsd = 0;
  let activeClaimableUsd = safeNumber(rows[0].total_claimable_usd);
  let resetCount = 0;
  const resetPoints = [];

  for (let i = 1; i < rows.length; i += 1) {
    const previousRow = rows[i - 1];
    const currentRow = rows[i];

    if (shouldTreatAsClaimableReset(previousRow, currentRow)) {
      const lockedAtReset = safeNumber(previousRow.total_claimable_usd);

      lockedClaimableUsd += lockedAtReset;
      activeClaimableUsd = safeNumber(currentRow.total_claimable_usd);
      resetCount += 1;

      resetPoints.push({
        previous_metric_date: previousRow.metric_date,
        current_metric_date: currentRow.metric_date,
        locked_claimable_usd: lockedAtReset,
        restarted_claimable_usd: safeNumber(currentRow.total_claimable_usd),
      });
    } else {
      activeClaimableUsd = safeNumber(currentRow.total_claimable_usd);
    }
  }

  return {
    total_claimable_usd: safeNumber(lockedClaimableUsd + activeClaimableUsd),
    locked_claimable_usd: safeNumber(lockedClaimableUsd),
    active_claimable_usd: safeNumber(activeClaimableUsd),
    reset_count: resetCount,
    reset_points: resetPoints,
  };
}

function buildTimeframeSummary(rows, timeframe) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      is_live_mode: timeframe === "daily",
      header_labels: {
        tpv: timeframe === "daily" ? "Current TPV" : "Avg TPV",
        claimable:
          timeframe === "daily" ? "Current Claimable" : "Total Claimable",
        yield_flow:
          timeframe === "daily"
            ? "Current DYF"
            : `Total ${getYieldFlowPrefix(timeframe)}`,
        ratio:
          timeframe === "daily" ? "Yield / TVD" : getPeriodYieldLabel(timeframe),
      },
      latest_metric_date: null,
      latest_metric_time: null,
      avg_tpv: 0,
      total_claimable_usd: 0,
      total_yield_flow_usd: 0,
      period_yield_ratio: 0,
      period_yield_pct: 0,
      locked_claimable_usd: 0,
      active_claimable_usd: 0,
      claimable_reset_count: 0,
      claimable_reset_points: [],
    };
  }

  const latest = rows[rows.length - 1];
  const avgTpv = getAverageValue(
    rows.map((row) => safeNumber(row.total_portfolio_value))
  );
  const totalYieldFlowUsd = rows.reduce(
    (sum, row) => sum + safeNumber(row.total_daily_yield_flow),
    0
  );

  const claimableRollup = buildResetAwareTotalClaimable(rows);
  const periodYieldRatio = avgTpv > 0 ? totalYieldFlowUsd / avgTpv : 0;

  return {
    is_live_mode: timeframe === "daily",
    header_labels: {
      tpv: timeframe === "daily" ? "Current TPV" : "Avg TPV",
      claimable:
        timeframe === "daily" ? "Current Claimable" : "Total Claimable",
      yield_flow:
        timeframe === "daily"
          ? "Current DYF"
          : `Total ${getYieldFlowPrefix(timeframe)}`,
      ratio:
        timeframe === "daily" ? "Yield / TVD" : getPeriodYieldLabel(timeframe),
    },
    latest_metric_date: latest.metric_date || null,
    latest_metric_time: latest.metric_time || null,
    avg_tpv: safeNumber(avgTpv),
    total_claimable_usd: safeNumber(claimableRollup.total_claimable_usd),
    total_yield_flow_usd: safeNumber(totalYieldFlowUsd),
    period_yield_ratio: safeNumber(periodYieldRatio),
    period_yield_pct: safeNumber(periodYieldRatio * 100),
    locked_claimable_usd: safeNumber(claimableRollup.locked_claimable_usd),
    active_claimable_usd: safeNumber(claimableRollup.active_claimable_usd),
    claimable_reset_count: claimableRollup.reset_count,
    claimable_reset_points: claimableRollup.reset_points,
  };
}

function buildSummary(rows, { intraday = false, timeframe = "daily" } = {}) {
  const emptyTimeframeSummary = buildTimeframeSummary([], timeframe);

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
      timeframe_summary: emptyTimeframeSummary,
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
      metric_time: intraday ? latest.metric_time : null,
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
    timeframe_summary: buildTimeframeSummary(rows, timeframe),
  };
}

function findStrongestWeakest(rows, timeframe) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      strongest_period_label: null,
      strongest_period_value: null,
      weakest_period_label: null,
      weakest_period_value: null,
    };
  }

  let strongestRow = rows[0];
  let weakestRow = rows[0];

  for (const row of rows) {
    if (
      safeNumber(row.total_daily_yield_flow) >
      safeNumber(strongestRow.total_daily_yield_flow)
    ) {
      strongestRow = row;
    }

    if (
      safeNumber(row.total_daily_yield_flow) <
      safeNumber(weakestRow.total_daily_yield_flow)
    ) {
      weakestRow = row;
    }
  }

  return {
    strongest_period_label: formatMetricDateLabel(
      strongestRow.metric_date,
      timeframe
    ),
    strongest_period_value: safeNumber(strongestRow.total_daily_yield_flow),
    weakest_period_label: formatMetricDateLabel(
      weakestRow.metric_date,
      timeframe
    ),
    weakest_period_value: safeNumber(weakestRow.total_daily_yield_flow),
  };
}

export {
  normalizeTimeframe,
  getTimeframeDays,
  getMinimumRequiredRows,
  getStartDateIso,
  getIntradayStartIso,
  getAsOfDateIso,
  formatMetricDateLabel,
  formatDailyBucketLabel,
  getYieldFlowPrefix,
  getPeriodYieldLabel,
  buildStoredTrend,
  buildIntradayTrend,
  shouldTreatAsClaimableReset,
  buildResetAwareTotalClaimable,
  buildTimeframeSummary,
  buildSummary,
  findStrongestWeakest,
};