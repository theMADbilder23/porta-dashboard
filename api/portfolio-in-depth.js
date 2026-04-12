const { createClient } = require("@supabase/supabase-js");
const {
  normalizeTimeframe,
  getMinimumRequiredRows,
  getStartDateIso,
  getIntradayStartIso,
  buildStoredTrend,
  buildIntradayTrend,
  buildSummary,
} = require("./lib/porta-math/derived-metrics.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toDateMs(value) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortRowsByMetricDateAsc(rows) {
  return [...safeArray(rows)].sort(
    (a, b) =>
      toDateMs(`${a.metric_date || ""}T00:00:00Z`) -
      toDateMs(`${b.metric_date || ""}T00:00:00Z`)
  );
}

function sortRowsByMetricDateDesc(rows) {
  return [...safeArray(rows)].sort(
    (a, b) =>
      toDateMs(`${b.metric_date || ""}T00:00:00Z`) -
      toDateMs(`${a.metric_date || ""}T00:00:00Z`)
  );
}

function titleCaseTimeframe(timeframe) {
  if (!timeframe) return "Period";
  return timeframe.charAt(0).toUpperCase() + timeframe.slice(1);
}

function formatDateLabel(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildTimeframeArchiveLabel(row, timeframe) {
  const start = row?.window_start_date || null;
  const end = row?.window_end_date || row?.as_of_date || null;

  if (timeframe === "weekly") {
    return end ? `Week Ending ${formatDateLabel(end)}` : "Week";
  }

  if (timeframe === "monthly") {
    if (end) {
      const date = new Date(`${end}T00:00:00Z`);
      if (Number.isFinite(date.getTime())) {
        return date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      }
    }
    return "Month";
  }

  if (timeframe === "quarterly") {
    if (start) {
      const date = new Date(`${start}T00:00:00Z`);
      if (Number.isFinite(date.getTime())) {
        const month = date.getUTCMonth();
        const year = date.getUTCFullYear();
        const quarter = Math.floor(month / 3) + 1;
        return `Q${quarter} ${year}`;
      }
    }

    if (end) {
      return `Quarter Ending ${formatDateLabel(end)}`;
    }

    return "Quarter";
  }

  if (timeframe === "yearly") {
    if (start) {
      const date = new Date(`${start}T00:00:00Z`);
      if (Number.isFinite(date.getTime())) {
        return String(date.getUTCFullYear());
      }
    }

    if (end) {
      const date = new Date(`${end}T00:00:00Z`);
      if (Number.isFinite(date.getTime())) {
        return String(date.getUTCFullYear());
      }
    }

    return "Year";
  }

  return end ? formatDateLabel(end) : "Period";
}

function mapTimeframeSnapshotRow(row, timeframe) {
  const metricDate = row?.as_of_date || row?.window_end_date || null;

  return {
    id: row?.id || null,
    timeframe,
    label: buildTimeframeArchiveLabel(row, timeframe),
    metric_date: metricDate,
    metric_time: null,

    total_portfolio_value: safeNumber(row?.avg_tpv),
    total_claimable_usd: safeNumber(row?.total_claimable_usd),
    total_daily_yield_flow: safeNumber(row?.total_yield_flow_usd),
    min_claimable_usd: safeNumber(row?.min_yield_flow_usd),
    avg_claimable_usd: safeNumber(row?.avg_yield_flow_usd),
    max_claimable_usd: safeNumber(row?.max_yield_flow_usd),
    yield_tvd_ratio: safeNumber(row?.period_yield_ratio),

    avg_tpv: safeNumber(row?.avg_tpv),
    min_tpv: safeNumber(row?.min_tpv),
    max_tpv: safeNumber(row?.max_tpv),

    total_yield_flow_usd: safeNumber(row?.total_yield_flow_usd),
    avg_yield_flow_usd: safeNumber(row?.avg_yield_flow_usd),
    min_yield_flow_usd: safeNumber(row?.min_yield_flow_usd),
    max_yield_flow_usd: safeNumber(row?.max_yield_flow_usd),

    period_yield_ratio: safeNumber(row?.period_yield_ratio),
    period_yield_pct: safeNumber(row?.period_yield_pct),

    locked_claimable_usd: safeNumber(row?.locked_claimable_usd),
    active_claimable_usd: safeNumber(row?.active_claimable_usd),
    claimable_reset_count: Number.isFinite(Number(row?.claimable_reset_count))
      ? Number(row.claimable_reset_count)
      : 0,

    strongest_period_label: row?.strongest_period_label || null,
    strongest_period_value: safeNumber(row?.strongest_period_value),
    weakest_period_label: row?.weakest_period_label || null,
    weakest_period_value: safeNumber(row?.weakest_period_value),

    source_row_count: Number.isFinite(Number(row?.source_row_count))
      ? Number(row.source_row_count)
      : 0,
    minimum_required_rows: Number.isFinite(Number(row?.minimum_required_rows))
      ? Number(row.minimum_required_rows)
      : 0,
    sufficient_data: Boolean(row?.sufficient_data),

    window_start_date: row?.window_start_date || null,
    window_end_date: row?.window_end_date || null,
    as_of_date: row?.as_of_date || null,

    summary_json: row?.summary_json || null,
    debug_json: row?.debug_json || null,

    created_at: row?.created_at || null,
  };
}

function buildArchiveHistoricalSummary(rows) {
  const safeRows = safeArray(rows);
  if (!safeRows.length) {
    return {
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
    };
  }

  const tpvValues = safeRows.map((row) => safeNumber(row.avg_tpv));
  const claimableValues = safeRows.map((row) => safeNumber(row.total_claimable_usd));
  const yieldValues = safeRows.map((row) => safeNumber(row.total_yield_flow_usd));
  const ratioValues = safeRows.map((row) => safeNumber(row.period_yield_ratio));

  const minTpv = Math.min(...tpvValues);
  const maxTpv = Math.max(...tpvValues);
  const minClaimable = Math.min(...claimableValues);
  const maxClaimable = Math.max(...claimableValues);
  const minYield = Math.min(...yieldValues);
  const maxYield = Math.max(...yieldValues);
  const minRatio = Math.min(...ratioValues);
  const maxRatio = Math.max(...ratioValues);

  const avg = (values) =>
    values.length
      ? values.reduce((sum, value) => sum + safeNumber(value), 0) / values.length
      : 0;

  return {
    avg_portfolio_value: avg(tpvValues),
    min_portfolio_value: minTpv,
    max_portfolio_value: maxTpv,

    avg_claimable_usd: avg(claimableValues),
    min_claimable_usd: minClaimable,
    max_claimable_usd: maxClaimable,

    avg_daily_yield_flow: avg(yieldValues),
    min_daily_yield_flow: minYield,
    max_daily_yield_flow: maxYield,

    avg_yield_tvd_ratio: avg(ratioValues),
    min_yield_tvd_ratio: minRatio,
    max_yield_tvd_ratio: maxRatio,

    range_portfolio_pct: minTpv > 0 ? ((maxTpv - minTpv) / minTpv) * 100 : 0,
    range_claimable_pct:
      minClaimable > 0 ? ((maxClaimable - minClaimable) / minClaimable) * 100 : 0,
    range_daily_yield_pct:
      minYield > 0 ? ((maxYield - minYield) / minYield) * 100 : 0,
  };
}

function buildArchiveSummaryPayload(rows, timeframe) {
  const sortedAsc = [...safeArray(rows)].sort(
    (a, b) =>
      toDateMs(`${a.metric_date || ""}T00:00:00Z`) -
      toDateMs(`${b.metric_date || ""}T00:00:00Z`)
  );

  const latest = sortedAsc[sortedAsc.length - 1] || null;
  const historical = buildArchiveHistoricalSummary(sortedAsc);

  return {
    current: {
      metric_date: latest?.metric_date || null,
      metric_time: null,
      total_portfolio_value: safeNumber(latest?.avg_tpv),
      total_claimable_usd: safeNumber(latest?.total_claimable_usd),
      total_daily_yield_flow: safeNumber(latest?.total_yield_flow_usd),
      min_claimable_usd: safeNumber(latest?.min_yield_flow_usd),
      avg_claimable_usd: safeNumber(latest?.avg_yield_flow_usd),
      max_claimable_usd: safeNumber(latest?.max_yield_flow_usd),
      yield_tvd_ratio: safeNumber(latest?.period_yield_ratio),
    },
    historical,
    timeframe_summary: latest
      ? {
          is_live_mode: false,
          header_labels: {
            tpv: "Avg TPV",
            claimable: "Total Claimable",
            yield_flow: "Total Yield Flow",
            ratio: "Period Yield %",
          },
          latest_metric_date: latest.metric_date,
          latest_metric_time: null,
          avg_tpv: safeNumber(latest.avg_tpv),
          total_claimable_usd: safeNumber(latest.total_claimable_usd),
          total_yield_flow_usd: safeNumber(latest.total_yield_flow_usd),
          period_yield_ratio: safeNumber(latest.period_yield_ratio),
          period_yield_pct: safeNumber(latest.period_yield_pct),
          locked_claimable_usd: safeNumber(latest.locked_claimable_usd),
          active_claimable_usd: safeNumber(latest.active_claimable_usd),
          claimable_reset_count: Number.isFinite(Number(latest.claimable_reset_count))
            ? Number(latest.claimable_reset_count)
            : 0,
        }
      : {
          is_live_mode: false,
          header_labels: {
            tpv: "Avg TPV",
            claimable: "Total Claimable",
            yield_flow: "Total Yield Flow",
            ratio: "Period Yield %",
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
        },
  };
}

async function loadHistoricalTable(timeframe) {
  if (timeframe === "daily") {
    const { data, error } = await supabase
      .from("daily_metric_snapshots")
      .select("*")
      .order("metric_date", { ascending: false })
      .limit(120);

    if (error) {
      throw new Error("Failed to load historical daily metrics");
    }

    const rowsDesc = safeArray(data);
    const rowsAsc = sortRowsByMetricDateAsc(rowsDesc);

    return {
      enabled: true,
      source: "daily_metric_snapshots",
      metric_label: "Historical Daily Metrics",
      sufficient_data: rowsDesc.length > 0,
      minimum_required_rows: 1,
      actual_rows: rowsDesc.length,
      summary: buildSummary(rowsAsc, { intraday: false, timeframe: "daily" }),
      trend: buildStoredTrend(rowsAsc, "daily"),
      rows: rowsDesc,
    };
  }

  const { data, error } = await supabase
    .from("timeframe_metric_snapshots")
    .select("*")
    .eq("timeframe", timeframe)
    .order("as_of_date", { ascending: false })
    .limit(120);

  if (error) {
    throw new Error(`Failed to load historical ${timeframe} metrics`);
  }

  const mappedRowsDesc = safeArray(data).map((row) =>
    mapTimeframeSnapshotRow(row, timeframe)
  );

  const mappedRowsAsc = [...mappedRowsDesc].sort(
    (a, b) =>
      toDateMs(`${a.metric_date || ""}T00:00:00Z`) -
      toDateMs(`${b.metric_date || ""}T00:00:00Z`)
  );

  const latest = mappedRowsDesc[0] || null;
  const minimumRequiredRows = latest
    ? Number.isFinite(Number(latest.minimum_required_rows))
      ? Number(latest.minimum_required_rows)
      : 1
    : 1;

  return {
    enabled: true,
    source: "timeframe_metric_snapshots",
    metric_label: `Historical ${titleCaseTimeframe(timeframe)} Metrics`,
    sufficient_data: mappedRowsDesc.length > 0,
    minimum_required_rows: minimumRequiredRows,
    actual_rows: mappedRowsDesc.length,
    summary: buildArchiveSummaryPayload(mappedRowsAsc, timeframe),
    trend: mappedRowsAsc,
    rows: mappedRowsDesc,
  };
}

module.exports = async function handler(req, res) {
  try {
    const timeframe = normalizeTimeframe(req.query?.timeframe);

    if (timeframe === "daily") {
      const intradayStartIso = getIntradayStartIso();

      const [liveResult, historicalTable] = await Promise.all([
        supabase
          .from("intraday_metric_snapshots")
          .select("*")
          .gte("metric_time", intradayStartIso)
          .order("metric_time", { ascending: true }),
        loadHistoricalTable("daily"),
      ]);

      const { data, error } = liveResult;

      if (error) {
        return res.status(500).json({
          error: "Failed to load intraday portfolio metrics",
        });
      }

      const rows = safeArray(data);

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
          historical_table: historicalTable,
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
        historical_table: historicalTable,
      });
    }

    const startDate = getStartDateIso(timeframe);
    const minimumRequiredRows = getMinimumRequiredRows(timeframe);

    const [liveResult, historicalTable] = await Promise.all([
      supabase
        .from("daily_metric_snapshots")
        .select("*")
        .gte("metric_date", startDate)
        .order("metric_date", { ascending: true }),
      loadHistoricalTable(timeframe),
    ]);

    const { data, error } = liveResult;

    if (error) {
      return res.status(500).json({
        error: "Failed to load portfolio in-depth metrics",
      });
    }

    const rows = safeArray(data);

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
        historical_table: historicalTable,
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
      historical_table: historicalTable,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: error?.message || "Unknown error",
    });
  }
};