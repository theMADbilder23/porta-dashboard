"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

type Timeframe = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
type SortField =
  | "date"
  | "tpv"
  | "claimable"
  | "dyf"
  | "min"
  | "avg"
  | "max"
  | "yield_ratio";
type SortDirection = "asc" | "desc";
type QuickFilter =
  | "none"
  | "strongest-dyf"
  | "weakest-dyf"
  | "max-tpv"
  | "min-tpv";

type ChartMetric =
  | "tpv"
  | "claimable"
  | "dyf"
  | "min"
  | "avg"
  | "max"
  | "yieldRatioPct";

type RangePreset = "7" | "14" | "30" | "all";

type BaseTrendRow = {
  metric_date: string;
  metric_time?: string | null;
  label: string;
  total_portfolio_value: number;
  total_claimable_usd: number;
  total_daily_yield_flow: number;
  min_claimable_usd: number;
  avg_claimable_usd: number;
  max_claimable_usd: number;
  yield_tvd_ratio: number;
  debug_json: Record<string, unknown> | null;
};

type HistoricalArchiveRow = {
  id?: string | null;
  timeframe?: Timeframe;
  label: string;
  metric_date: string;
  metric_time?: string | null;

  total_portfolio_value: number;
  total_claimable_usd: number;
  total_daily_yield_flow: number;
  min_claimable_usd: number;
  avg_claimable_usd: number;
  max_claimable_usd: number;
  yield_tvd_ratio: number;

  avg_tpv?: number;
  min_tpv?: number;
  max_tpv?: number;

  total_yield_flow_usd?: number;
  avg_yield_flow_usd?: number;
  min_yield_flow_usd?: number;
  max_yield_flow_usd?: number;

  period_yield_ratio?: number;
  period_yield_pct?: number;

  locked_claimable_usd?: number;
  active_claimable_usd?: number;
  claimable_reset_count?: number;

  strongest_period_label?: string | null;
  strongest_period_value?: number;
  weakest_period_label?: string | null;
  weakest_period_value?: number;

  source_row_count?: number;
  minimum_required_rows?: number;
  sufficient_data?: boolean;

  window_start_date?: string | null;
  window_end_date?: string | null;
  as_of_date?: string | null;

  summary_json?: Record<string, unknown> | null;
  debug_json?: Record<string, unknown> | null;

  created_at?: string | null;
};

type SharedSummary = {
  current: {
    metric_date: string | null;
    metric_time?: string | null;
    total_portfolio_value: number;
    total_claimable_usd: number;
    total_daily_yield_flow: number;
    min_claimable_usd: number;
    avg_claimable_usd: number;
    max_claimable_usd: number;
    yield_tvd_ratio: number;
  };
  historical: {
    avg_portfolio_value: number;
    min_portfolio_value: number;
    max_portfolio_value: number;
    avg_claimable_usd: number;
    min_claimable_usd: number;
    max_claimable_usd: number;
    avg_daily_yield_flow: number;
    min_daily_yield_flow: number;
    max_daily_yield_flow: number;
    avg_yield_tvd_ratio: number;
    min_yield_tvd_ratio: number;
    max_yield_tvd_ratio: number;
    range_portfolio_pct: number;
    range_claimable_pct: number;
    range_daily_yield_pct: number;
  };
  timeframe_summary?: {
    is_live_mode: boolean;
    header_labels: {
      tpv: string;
      claimable: string;
      yield_flow: string;
      ratio: string;
    };
    latest_metric_date: string | null;
    latest_metric_time?: string | null;
    avg_tpv: number;
    total_claimable_usd: number;
    total_yield_flow_usd: number;
    period_yield_ratio: number;
    period_yield_pct: number;
    locked_claimable_usd?: number;
    active_claimable_usd?: number;
    claimable_reset_count?: number;
    claimable_reset_points?: Array<{
      previous_metric_date: string;
      current_metric_date: string;
      locked_claimable_usd: number;
      restarted_claimable_usd: number;
    }>;
  };
};

type HistoricalTablePayload = {
  enabled: boolean;
  source: "daily_metric_snapshots" | "timeframe_metric_snapshots";
  metric_label: string;
  sufficient_data: boolean;
  minimum_required_rows: number;
  actual_rows: number;
  summary: SharedSummary;
  trend: BaseTrendRow[];
  rows: HistoricalArchiveRow[];
};

type PortfolioInDepthResponse = {
  timeframe: Timeframe;
  metric_label: string;
  sufficient_data: boolean;
  minimum_required_rows: number;
  actual_rows: number;
  summary: SharedSummary;
  trend: Array<{
    metric_date: string;
    metric_time?: string | null;
    label: string;
    total_portfolio_value: number;
    total_claimable_usd: number;
    total_daily_yield_flow: number;
    min_claimable_usd: number;
    avg_claimable_usd: number;
    max_claimable_usd: number;
    yield_tvd_ratio: number;
    debug_json: Record<string, unknown> | null;
  }>;
  rows: Array<{
    id?: string;
    metric_date: string;
    metric_time?: string | null;
    total_portfolio_value: number;
    total_claimable_usd: number;
    total_daily_yield_flow: number;
    min_claimable_usd: number;
    avg_claimable_usd: number;
    max_claimable_usd: number;
    yield_tvd_ratio: number;
    debug_json: Record<string, unknown> | null;
    created_at?: string;
    updated_at?: string;
  }>;
  historical_table?: HistoricalTablePayload;
};

function safeNumber(value: unknown) {
  const numericValue =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCurrency(value: number, digits = 2) {
  return `$${safeNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatCompactCurrency(value: number) {
  const safeValue = safeNumber(value);
  const abs = Math.abs(safeValue);

  if (abs >= 1_000_000_000) return `$${(safeValue / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(safeValue / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(safeValue / 1_000).toFixed(2)}K`;

  return formatCurrency(safeValue);
}

function formatPercent(value: number, digits = 2) {
  return `${safeNumber(value).toFixed(digits)}%`;
}

function formatRatioPercent(value: number) {
  return formatPercent(safeNumber(value) * 100, 2);
}

function formatDateLabel(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function titleCaseTimeframe(timeframe: Timeframe) {
  return timeframe.charAt(0).toUpperCase() + timeframe.slice(1);
}

function metricButtonLabel(metric: ChartMetric) {
  switch (metric) {
    case "tpv":
      return "TPV";
    case "claimable":
      return "Claimable";
    case "dyf":
      return "DYF";
    case "min":
      return "Min";
    case "avg":
      return "Avg";
    case "max":
      return "Max";
    case "yieldRatioPct":
      return "Yield / TVD";
    default:
      return metric;
  }
}

function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative inline-flex cursor-help items-center gap-1">
      {children}
      <span className="text-[10px] text-[#8B5CF6] dark:text-[#C084FC]">ⓘ</span>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-[220px] -translate-x-1/2 rounded-lg border border-[#E9DAFF] bg-white px-3 py-2 text-xs leading-5 text-[#2D1B45] opacity-0 shadow-md transition-all duration-150 group-hover:opacity-100 dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF]">
        {label}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  tooltip,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      {tooltip ? (
        <Tooltip label={tooltip}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            {label}
          </p>
        </Tooltip>
      ) : (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
          {label}
        </p>
      )}

      <h3 className="mt-3 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {value}
      </h3>

      {sublabel ? (
        <p className="mt-2 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">{sublabel}</p>
      ) : null}
    </div>
  );
}

function CompactStat({
  label,
  value,
  sublabel,
  emphasis = false,
  compact = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  emphasis?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl bg-[#F8F4FF] dark:bg-[#140D20] ${
        compact ? "px-4 py-3" : "p-4"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <p
        className={`font-semibold ${
          compact ? "mt-1.5 text-lg" : "mt-2 text-xl"
        } ${
          emphasis
            ? "text-[#6D28D9] dark:text-[#D8B4FE]"
            : "text-[#2D1B45] dark:text-[#F3E8FF]"
        }`}
      >
        {value}
      </p>
      {sublabel ? (
        <p
          className={`text-[#6B5A86] dark:text-[#BFA9F5] ${
            compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"
          }`}
        >
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8B5CF6] dark:text-[#C084FC]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {title}
      </h2>
      {description ? (
        <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function getRowSearchText(row: BaseTrendRow, isDaily: boolean) {
  const dateText = row.metric_date || "";
  const timeText = row.metric_time || "";
  const labelText = row.label || "";

  return [dateText, timeText, labelText].join(" ").toLowerCase();
}

function getRowSortValue(row: BaseTrendRow, field: SortField, isDaily: boolean) {
  switch (field) {
    case "tpv":
      return safeNumber(row.total_portfolio_value);
    case "claimable":
      return safeNumber(row.total_claimable_usd);
    case "dyf":
      return safeNumber(row.total_daily_yield_flow);
    case "min":
      return safeNumber(row.min_claimable_usd);
    case "avg":
      return safeNumber(row.avg_claimable_usd);
    case "max":
      return safeNumber(row.max_claimable_usd);
    case "yield_ratio":
      return safeNumber(row.yield_tvd_ratio);
    case "date":
    default:
      if (isDaily) {
        return new Date(row.metric_time || row.metric_date).getTime();
      }
      return new Date(`${row.metric_date}T00:00:00Z`).getTime();
  }
}

export default function PortfolioInDepthPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [data, setData] = useState<PortfolioInDepthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("none");

  const [selectedChartMetrics, setSelectedChartMetrics] = useState<ChartMetric[]>([
    "tpv",
    "dyf",
  ]);
  const [rangePreset, setRangePreset] = useState<RangePreset>("all");

  async function loadData(selectedTimeframe: Timeframe) {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/portfolio-in-depth?timeframe=${selectedTimeframe}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const json = (await response.json()) as PortfolioInDepthResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData(timeframe);
  }, [timeframe]);

  useEffect(() => {
    setSearchTerm("");
    setSortField("date");
    setSortDirection("desc");
    setQuickFilter("none");
    setSelectedChartMetrics(["tpv", "dyf"]);
    setRangePreset("all");
  }, [timeframe]);

  const current = data?.summary.current;
  const historical = data?.summary.historical;
  const timeframeSummary = data?.summary.timeframe_summary;
  const trend = data?.trend ?? [];
  const historicalTable = data?.historical_table;

  const timeframeOptions: Timeframe[] = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
  ];

  const chartMetricOptions: ChartMetric[] = [
    "tpv",
    "claimable",
    "dyf",
    "min",
    "avg",
    "max",
    "yieldRatioPct",
  ];

  const rangePresetOptions: RangePreset[] = ["7", "14", "30", "all"];

  const isDaily = timeframe === "daily";
  const timeframeLabel = titleCaseTimeframe(timeframe);

  const strongestDay = useMemo(() => {
    if (!trend.length) return null;
    return [...trend].sort(
      (a, b) =>
        safeNumber(b.total_daily_yield_flow) -
        safeNumber(a.total_daily_yield_flow)
    )[0];
  }, [trend]);

  const weakestDay = useMemo(() => {
    if (!trend.length) return null;
    return [...trend].sort(
      (a, b) =>
        safeNumber(a.total_daily_yield_flow) -
        safeNumber(b.total_daily_yield_flow)
    )[0];
  }, [trend]);

  const displayTrend = useMemo(() => {
    let rows = [...trend];

    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      rows = rows.filter((row) =>
        getRowSearchText(row, isDaily).includes(normalizedSearch)
      );
    }

    if (quickFilter === "strongest-dyf") {
      rows.sort(
        (a, b) =>
          safeNumber(b.total_daily_yield_flow) -
          safeNumber(a.total_daily_yield_flow)
      );
      return rows;
    }

    if (quickFilter === "weakest-dyf") {
      rows.sort(
        (a, b) =>
          safeNumber(a.total_daily_yield_flow) -
          safeNumber(b.total_daily_yield_flow)
      );
      return rows;
    }

    if (quickFilter === "max-tpv") {
      rows.sort(
        (a, b) =>
          safeNumber(b.total_portfolio_value) -
          safeNumber(a.total_portfolio_value)
      );
      return rows;
    }

    if (quickFilter === "min-tpv") {
      rows.sort(
        (a, b) =>
          safeNumber(a.total_portfolio_value) -
          safeNumber(b.total_portfolio_value)
      );
      return rows;
    }

    rows.sort((a, b) => {
      const valueA = getRowSortValue(a, sortField, isDaily);
      const valueB = getRowSortValue(b, sortField, isDaily);

      if (sortDirection === "asc") return valueA - valueB;
      return valueB - valueA;
    });

    return rows;
  }, [trend, searchTerm, quickFilter, sortField, sortDirection, isDaily]);

  const historicalRows = historicalTable?.rows ?? [];
  const historicalTrend = historicalTable?.trend ?? [];
  const historicalSummary = historicalTable?.summary?.historical;
  const historicalSource = historicalTable?.source;

  const historicalChartSeries = useMemo(() => {
    return [...historicalTrend].map((row) => ({
      label: isDaily
        ? formatDateLabel(row.metric_date)
        : row.label || formatDateLabel(row.metric_date),
      rawDate: row.metric_date,
      tpv: safeNumber(row.total_portfolio_value),
      claimable: safeNumber(row.total_claimable_usd),
      dyf: safeNumber(row.total_daily_yield_flow),
      min: safeNumber(row.min_claimable_usd),
      avg: safeNumber(row.avg_claimable_usd),
      max: safeNumber(row.max_claimable_usd),
      yieldRatioPct: safeNumber(row.yield_tvd_ratio) * 100,
    }));
  }, [historicalTrend, isDaily]);

  const rangedHistoricalChartSeries = useMemo(() => {
    if (rangePreset === "all") return historicalChartSeries;
    const count = Number(rangePreset);
    if (!Number.isFinite(count) || count <= 0) return historicalChartSeries;
    return historicalChartSeries.slice(-count);
  }, [historicalChartSeries, rangePreset]);

  const toggleChartMetric = (metric: ChartMetric) => {
    setSelectedChartMetrics((prev) => {
      if (prev.includes(metric)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== metric);
      }
      return [...prev, metric];
    });
  };

  const headerCardLabels = isDaily
    ? {
        tpv: "Current TPV",
        claimable: "Current Claimable",
        yieldFlow: "Current DYF",
        ratio: "Yield / TVD",
      }
    : {
        tpv: timeframeSummary?.header_labels?.tpv || "Avg TPV",
        claimable:
          timeframeSummary?.header_labels?.claimable || "Total Claimable",
        yieldFlow:
          timeframeSummary?.header_labels?.yield_flow || "Total Yield Flow",
        ratio: timeframeSummary?.header_labels?.ratio || "Period Yield %",
      };

  const headerCardValues = isDaily
    ? {
        tpv: formatCurrency(current?.total_portfolio_value ?? 0),
        claimable: formatCurrency(current?.total_claimable_usd ?? 0),
        yieldFlow: formatCurrency(current?.total_daily_yield_flow ?? 0),
        ratio: formatRatioPercent(current?.yield_tvd_ratio ?? 0),
      }
    : {
        tpv: formatCurrency(timeframeSummary?.avg_tpv ?? 0),
        claimable: formatCurrency(timeframeSummary?.total_claimable_usd ?? 0),
        yieldFlow: formatCurrency(timeframeSummary?.total_yield_flow_usd ?? 0),
        ratio: formatPercent(timeframeSummary?.period_yield_pct ?? 0),
      };

  const headerCardSublabels = isDaily
    ? {
        tpv: `Latest bucket: ${formatDateTimeLabel(current?.metric_time ?? null)}`,
        claimable: "Latest live bucket total claimable value.",
        yieldFlow: "Current live daily yield flow across today’s bucket set.",
        ratio: "Live daily bucket ratio view.",
      }
    : {
        tpv: `Average portfolio value across selected ${timeframe} window.`,
        claimable:
          timeframeSummary?.claimable_reset_count &&
          timeframeSummary.claimable_reset_count > 0
            ? `Reset-aware total claimable across ${timeframeSummary.claimable_reset_count} detected reset cycle(s).`
            : "Reset-aware total claimable across selected timeframe.",
        yieldFlow: `Summed ${headerCardLabels.yieldFlow} across the selected timeframe.`,
        ratio: "Period yield relative to average TPV across the selected timeframe.",
      };

  const headerCardTooltips = isDaily
    ? {
        tpv: "Latest live 30-minute bucket Total Portfolio Value for the current UTC day.",
        claimable:
          "Latest live total claimable USD from the current day’s 30-minute snapshot buckets.",
        yieldFlow:
          "Live daily yield flow for the current UTC day, derived from the bucketed DYF engine.",
        ratio:
          "Current daily bucket ratio field. Can be expanded later if you want live Yield/TVD logic here.",
      }
    : {
        tpv:
          "Average Total Portfolio Value across the selected historical timeframe.",
        claimable:
          "Reset-aware cumulative claimable total. This uses the active claimable stream until a reset is detected, then locks the pre-reset value and adds the new active claimable stream.",
        yieldFlow:
          "Total timeframe yield flow across the selected historical window.",
        ratio:
          "Period yield percentage calculated from total timeframe yield flow relative to average TPV.",
      };

  const livePanelTitle = isDaily
    ? "Live Daily Metrics Panel"
    : `Live ${timeframeLabel} Metrics Panel`;

  const livePanelDescription = isDaily
    ? "Compact live 30-minute bucket review for the current UTC day. This section is meant for quick inspection without dominating the page."
    : `Compact live ${timeframe.toLowerCase()} review panel derived from the current working calculation layer. This stays available for inspection while the deeper analysis below becomes the main focus.`;

  const historicalTableTitle = isDaily
    ? "Historical Daily Metrics Table"
    : `Historical ${timeframeLabel} Metrics Table`;

  const historicalChartTitle = isDaily
    ? "Historical Daily Trend Explorer"
    : `${timeframeLabel} Historical Trend Explorer`;

  return (
    <div className="min-h-screen space-y-6 p-6">
      <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="flex flex-col gap-5 desktop:flex-row desktop:items-end desktop:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6] dark:text-[#C084FC]">
              Portfolio / In-Depth
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
              Portfolio In-Depth
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
              Historical review layer for MMII portfolio intelligence. This page
              turns the Overview metrics into stored, reviewable history so DYF,
              TPV, min/avg/max, and yield efficiency can be inspected over time.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {timeframeOptions.map((option) => {
              const isActive = timeframe === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTimeframe(option)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    isActive
                      ? "bg-[#7C3AED] text-white shadow-sm"
                      : "border border-[#E9DAFF] bg-white text-[#6D28D9] hover:bg-[#F3E8FF] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-[#F5C2E7] bg-[#FFF5FA] p-5 text-sm text-[#9D174D] dark:border-[#4A1D33] dark:bg-[#1A0F18] dark:text-[#F9A8D4]">
          Failed to load Portfolio In-Depth data: {error}
        </section>
      ) : null}

      {isLoading ? (
        <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
            Loading historical portfolio metrics...
          </p>
        </section>
      ) : null}

      {!isLoading && data && !data.sufficient_data ? (
        <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <h2 className="text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {isDaily ? "No daily snapshot buckets yet" : "Not enough historical data yet"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            {isDaily
              ? "The daily view shows live 30-minute portfolio snapshot buckets for the current UTC day. No buckets are available yet."
              : `This timeframe needs at least ${data.minimum_required_rows} stored day rows, but only ${data.actual_rows} are currently available.`}
          </p>
        </section>
      ) : null}

      {!isLoading && data && data.sufficient_data ? (
        <>
          <section className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
            <MetricCard
              label={headerCardLabels.tpv}
              value={headerCardValues.tpv}
              sublabel={headerCardSublabels.tpv}
              tooltip={headerCardTooltips.tpv}
            />

            <MetricCard
              label={headerCardLabels.claimable}
              value={headerCardValues.claimable}
              sublabel={headerCardSublabels.claimable}
              tooltip={headerCardTooltips.claimable}
            />

            <MetricCard
              label={headerCardLabels.yieldFlow}
              value={headerCardValues.yieldFlow}
              sublabel={headerCardSublabels.yieldFlow}
              tooltip={headerCardTooltips.yieldFlow}
            />

            <MetricCard
              label={headerCardLabels.ratio}
              value={headerCardValues.ratio}
              sublabel={headerCardSublabels.ratio}
              tooltip={headerCardTooltips.ratio}
            />
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <SectionHeader
              title="Metrics Table Overview"
              description={
                isDaily
                  ? "Live in-day summary of the current UTC day’s 30-minute bucket set."
                  : "Summary layer for the currently selected historical dataset. This panel shows the minimum, average, and maximum values found inside the live metrics table for the selected timeframe."
              }
            />

            <div className="mt-4 grid grid-cols-2 gap-4 laptop:grid-cols-3 desktop:grid-cols-6">
              <CompactStat
                label="Min TPV"
                value={formatCompactCurrency(historical?.min_portfolio_value ?? 0)}
              />
              <CompactStat
                label="Avg TPV"
                value={formatCompactCurrency(historical?.avg_portfolio_value ?? 0)}
              />
              <CompactStat
                label="Max TPV"
                value={formatCompactCurrency(historical?.max_portfolio_value ?? 0)}
              />
              <CompactStat
                label="Min DYF"
                value={formatCurrency(historical?.min_daily_yield_flow ?? 0)}
                emphasis
              />
              <CompactStat
                label="Avg DYF"
                value={formatCurrency(historical?.avg_daily_yield_flow ?? 0)}
                emphasis
              />
              <CompactStat
                label="Max DYF"
                value={formatCurrency(historical?.max_daily_yield_flow ?? 0)}
                emphasis
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
            <SectionHeader
              title="Period Highlights"
              description="Quick scan of the strongest and weakest yield-flow entries, row coverage, and TPV range."
            />

            <div className="mt-3 grid grid-cols-2 gap-3 desktop:grid-cols-4">
              <CompactStat
                label={isDaily ? "Strongest Bucket" : "Strongest DYF Day"}
                value={strongestDay ? strongestDay.label : "—"}
                sublabel={
                  strongestDay
                    ? formatCurrency(strongestDay.total_daily_yield_flow)
                    : "No data"
                }
                emphasis
                compact
              />
              <CompactStat
                label={isDaily ? "Weakest Bucket" : "Weakest DYF Day"}
                value={weakestDay ? weakestDay.label : "—"}
                sublabel={
                  weakestDay
                    ? formatCurrency(weakestDay.total_daily_yield_flow)
                    : "No data"
                }
                compact
              />
              <CompactStat
                label="Period TPV Range"
                value={formatPercent(historical?.range_portfolio_pct ?? 0)}
                sublabel={`Min ${formatCompactCurrency(
                  historical?.min_portfolio_value ?? 0
                )} → Max ${formatCompactCurrency(
                  historical?.max_portfolio_value ?? 0
                )}`}
                compact
              />
              <CompactStat
                label={isDaily ? "Live Buckets" : "Stored Rows"}
                value={String(displayTrend.length)}
                sublabel={
                  isDaily
                    ? "30-minute buckets in current UTC day"
                    : `Minimum required: ${data.minimum_required_rows}`
                }
                compact
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-4 desktop:flex-row desktop:items-end desktop:justify-between">
              <SectionHeader
                eyebrow="Live inspection layer"
                title={livePanelTitle}
                description={livePanelDescription}
              />

              <div className="grid grid-cols-2 gap-2 desktop:w-[360px]">
                <CompactStat
                  label="Visible Rows"
                  value={String(displayTrend.length)}
                  sublabel={isDaily ? "Current UTC day buckets" : "Current live calculated rows"}
                  compact
                />
                <CompactStat
                  label="Sort Mode"
                  value={
                    quickFilter === "none"
                      ? `${sortDirection === "asc" ? "Asc" : "Desc"}`
                      : "Quick Filter"
                  }
                  sublabel={
                    quickFilter === "none"
                      ? sortField === "date"
                        ? isDaily
                          ? "Snapshot time"
                          : "Date"
                        : sortField.toUpperCase()
                      : quickFilter
                  }
                  compact
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 dark:border-[#312047] dark:bg-[#120B1C]">
              <div className="grid grid-cols-1 gap-3 laptop:grid-cols-2 desktop:grid-cols-5">
                <div className="desktop:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isDaily ? "Search bucket time..." : "Search date/label..."}
                    className="w-full rounded-xl border border-[#E9DAFF] bg-white px-3 py-2 text-sm text-[#2D1B45] outline-none transition-colors focus:border-[#8B5CF6] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#F3E8FF]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Sort By
                  </label>
                  <select
                    value={sortField}
                    onChange={(e) => {
                      setSortField(e.target.value as SortField);
                      setQuickFilter("none");
                    }}
                    className="w-full rounded-xl border border-[#E9DAFF] bg-white px-3 py-2 text-sm text-[#2D1B45] outline-none transition-colors focus:border-[#8B5CF6] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#F3E8FF]"
                  >
                    <option value="date">{isDaily ? "Snapshot Time" : "Date"}</option>
                    <option value="tpv">TPV</option>
                    <option value="claimable">Claimable</option>
                    <option value="dyf">DYF</option>
                    <option value="min">Min</option>
                    <option value="avg">Avg</option>
                    <option value="max">Max</option>
                    <option value="yield_ratio">Yield / TVD</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Direction
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                      setQuickFilter("none");
                    }}
                    className="w-full rounded-xl border border-[#E9DAFF] bg-white px-3 py-2 text-sm font-medium text-[#6D28D9] transition-colors hover:bg-[#F3E8FF] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
                  >
                    {sortDirection === "asc" ? "Ascending" : "Descending"}
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Quick Filter
                  </label>
                  <select
                    value={quickFilter}
                    onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}
                    className="w-full rounded-xl border border-[#E9DAFF] bg-white px-3 py-2 text-sm text-[#2D1B45] outline-none transition-colors focus:border-[#8B5CF6] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#F3E8FF]"
                  >
                    <option value="none">None</option>
                    <option value="strongest-dyf">Strongest DYF</option>
                    <option value="weakest-dyf">Weakest DYF</option>
                    <option value="max-tpv">Max TPV</option>
                    <option value="min-tpv">Min TPV</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E9DAFF] dark:border-[#312047]">
              <div className="max-h-[168px] overflow-x-auto overflow-y-auto">
                <table className="min-w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[#F6F0FF] dark:bg-[#140D20]">
                    <tr className="border-b border-[#F0E8FF] dark:border-[#241533]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        {isDaily ? "Snapshot Time" : "Date"}
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        TPV
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Claimable
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        DYF
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Min
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Avg
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Max
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Yield / TVD
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {displayTrend.map((row, index) => (
                      <tr
                        key={row.metric_time || `${row.metric_date}-${index}`}
                        className="border-b border-[#F7F1FF] bg-white dark:border-[#1C1328] dark:bg-[#100A19]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                          {isDaily
                            ? formatDateTimeLabel(row.metric_time ?? null)
                            : formatDateLabel(row.metric_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatCurrency(row.total_portfolio_value)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatCurrency(row.total_claimable_usd)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#6D28D9] dark:text-[#D8B4FE]">
                          {formatCurrency(row.total_daily_yield_flow)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatCurrency(row.min_claimable_usd)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatCurrency(row.avg_claimable_usd)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatCurrency(row.max_claimable_usd)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatRatioPercent(row.yield_tvd_ratio)}
                        </td>
                      </tr>
                    ))}

                    {!displayTrend.length ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-6 text-center text-sm text-[#6B5A86] dark:text-[#BFA9F5]"
                        >
                          No rows match the current search/filter settings.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <SectionHeader
              eyebrow="Primary historical analysis layer"
              title="Historical Analysis"
              description="This section is intended to become the core review workspace for stored metrics history, trend filtering, and deeper visual analysis."
            />

            <div className="mt-6 grid grid-cols-1 gap-6">
              <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-5 dark:border-[#312047] dark:bg-[#120B1C]">
                <div className="flex flex-col gap-4 desktop:flex-row desktop:items-end desktop:justify-between">
                  <SectionHeader
                    title={historicalTableTitle}
                    description={
                      isDaily
                        ? "Stored prior-day review layer for daily metrics. This table stays separate from the live intraday panel above."
                        : `Stored ${timeframe.toLowerCase()} archive review powered by timeframe metric snapshots. This section supports cleaner long-range inspection as history expands.`
                    }
                  />

                  <div className="grid grid-cols-2 gap-2 desktop:w-[420px]">
                    <CompactStat
                      label="Source"
                      value={
                        historicalSource === "timeframe_metric_snapshots"
                          ? "TF Snapshots"
                          : "Daily Snapshots"
                      }
                      sublabel={historicalSource || "—"}
                      compact
                    />
                    <CompactStat
                      label="Archive Rows"
                      value={String(historicalTable?.actual_rows ?? 0)}
                      sublabel={`Minimum required: ${
                        historicalTable?.minimum_required_rows ?? 0
                      }`}
                      compact
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 laptop:grid-cols-3 desktop:grid-cols-6">
                  <CompactStat
                    label="Archive Avg TPV"
                    value={formatCompactCurrency(
                      historicalSummary?.avg_portfolio_value ?? 0
                    )}
                    compact
                  />
                  <CompactStat
                    label="Archive Min TPV"
                    value={formatCompactCurrency(
                      historicalSummary?.min_portfolio_value ?? 0
                    )}
                    compact
                  />
                  <CompactStat
                    label="Archive Max TPV"
                    value={formatCompactCurrency(
                      historicalSummary?.max_portfolio_value ?? 0
                    )}
                    compact
                  />
                  <CompactStat
                    label="Archive Avg DYF"
                    value={formatCurrency(
                      historicalSummary?.avg_daily_yield_flow ?? 0
                    )}
                    emphasis
                    compact
                  />
                  <CompactStat
                    label="Archive Min DYF"
                    value={formatCurrency(
                      historicalSummary?.min_daily_yield_flow ?? 0
                    )}
                    compact
                  />
                  <CompactStat
                    label="Archive Max DYF"
                    value={formatCurrency(
                      historicalSummary?.max_daily_yield_flow ?? 0
                    )}
                    compact
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-[#E9DAFF] dark:border-[#312047]">
                  <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
                    <table className="min-w-full text-left">
                      <thead className="sticky top-0 z-10 bg-[#F6F0FF] dark:bg-[#140D20]">
                        <tr className="border-b border-[#F0E8FF] dark:border-[#241533]">
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            {isDaily ? "Date" : "Period"}
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            TPV
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Claimable
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            DYF
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Min
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Avg
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Max
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Yield / TVD
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {historicalRows.map((row, index) => (
                          <tr
                            key={row.id || `${row.metric_date}-${index}`}
                            className="border-b border-[#F7F1FF] bg-white dark:border-[#1C1328] dark:bg-[#100A19]"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                              {row.label || formatDateLabel(row.metric_date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                              {formatCurrency(row.total_portfolio_value)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                              {formatCurrency(row.total_claimable_usd)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-[#6D28D9] dark:text-[#D8B4FE]">
                              {formatCurrency(row.total_daily_yield_flow)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                              {formatCurrency(row.min_claimable_usd)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                              {formatCurrency(row.avg_claimable_usd)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                              {formatCurrency(row.max_claimable_usd)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                              {formatRatioPercent(row.yield_tvd_ratio)}
                            </td>
                          </tr>
                        ))}

                        {!historicalRows.length ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-6 text-center text-sm text-[#6B5A86] dark:text-[#BFA9F5]"
                            >
                              No historical rows available yet for this timeframe.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-5 dark:border-[#312047] dark:bg-[#120B1C]">
                <SectionHeader
                  title={historicalChartTitle}
                  description="Advanced line chart workspace for the selected historical source. This version now uses a true interactive line chart with metric toggles and range presets."
                />

                <div className="mt-4 grid grid-cols-1 gap-3 laptop:grid-cols-2 desktop:grid-cols-4">
                  <CompactStat
                    label="Chart Source"
                    value={
                      historicalSource === "timeframe_metric_snapshots"
                        ? "TF Archive"
                        : "Daily Archive"
                    }
                    sublabel={historicalSource || "—"}
                    compact
                  />
                  <CompactStat
                    label="Series Loaded"
                    value={String(rangedHistoricalChartSeries.length)}
                    sublabel={`Range: ${rangePreset === "all" ? "All" : rangePreset}`}
                    compact
                  />
                  <CompactStat
                    label="Selected Metrics"
                    value={String(selectedChartMetrics.length)}
                    sublabel={selectedChartMetrics.map(metricButtonLabel).join(" / ")}
                    compact
                  />
                  <CompactStat
                    label="Chart State"
                    value={rangedHistoricalChartSeries.length ? "Interactive" : "Empty"}
                    sublabel="Line chart active"
                    compact
                  />
                </div>

                <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-[#DCC8FF] bg-white p-5 dark:border-[#3A2552] dark:bg-[#100A19]">
                  <div className="flex flex-col gap-4 desktop:flex-row desktop:items-center desktop:justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Metric Toggles
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {chartMetricOptions.map((metric) => {
                          const active = selectedChartMetrics.includes(metric);

                          return (
                            <button
                              key={metric}
                              type="button"
                              onClick={() => toggleChartMetric(metric)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? "bg-[#7C3AED] text-white"
                                  : "border border-[#E9DAFF] bg-white text-[#6D28D9] hover:bg-[#F3E8FF] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
                              }`}
                            >
                              {metricButtonLabel(metric)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Range Presets
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rangePresetOptions.map((preset) => {
                          const active = rangePreset === preset;

                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setRangePreset(preset)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? "bg-[#7C3AED] text-white"
                                  : "border border-[#E9DAFF] bg-white text-[#6D28D9] hover:bg-[#F3E8FF] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
                              }`}
                            >
                              {preset === "all" ? "All" : `Last ${preset}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="h-[360px] rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                    {rangedHistoricalChartSeries.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={rangedHistoricalChartSeries}
                          margin={{ top: 10, right: 16, left: 8, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E9DAFF" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: "#6B5A86" }}
                            tickLine={false}
                            axisLine={{ stroke: "#E9DAFF" }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#6B5A86" }}
                            tickLine={false}
                            axisLine={{ stroke: "#E9DAFF" }}
                            tickFormatter={(value) =>
                              typeof value === "number"
                                ? value >= 1000
                                  ? `$${(value / 1000).toFixed(0)}K`
                                  : `$${value.toFixed(0)}`
                                : ""
                            }
                          />
                          <RechartsTooltip
                            formatter={(value, name) => {
                              const numericValue = safeNumber(value);
                              const metricName = String(name);

                              if (metricName === "yieldRatioPct") {
                                return [formatPercent(numericValue, 2), "Yield / TVD"];
                              }

                              const labelMap: Record<string, string> = {
                                tpv: "TPV",
                                claimable: "Claimable",
                                dyf: "DYF",
                                min: "Min",
                                avg: "Avg",
                                max: "Max",
                              };

                              return [formatCurrency(numericValue), labelMap[metricName] || metricName];
                            }}
                            labelFormatter={(label) => `Period: ${String(label)}`}
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid #E9DAFF",
                              background: "#FFFFFF",
                              fontSize: 12,
                            }}
                          />
                          <Legend
                            formatter={(value) => metricButtonLabel(value as ChartMetric)}
                          />

                          {selectedChartMetrics.includes("tpv") ? (
                            <Line
                              type="monotone"
                              dataKey="tpv"
                              name="tpv"
                              stroke="#7C3AED"
                              strokeWidth={3}
                              dot={false}
                              activeDot={{ r: 5 }}
                            />
                          ) : null}

                          {selectedChartMetrics.includes("claimable") ? (
                            <Line
                              type="monotone"
                              dataKey="claimable"
                              name="claimable"
                              stroke="#A78BFA"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          ) : null}

                          {selectedChartMetrics.includes("dyf") ? (
                            <Line
                              type="monotone"
                              dataKey="dyf"
                              name="dyf"
                              stroke="#5B21B6"
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          ) : null}

                          {selectedChartMetrics.includes("min") ? (
                            <Line
                              type="monotone"
                              dataKey="min"
                              name="min"
                              stroke="#C4B5FD"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 3 }}
                            />
                          ) : null}

                          {selectedChartMetrics.includes("avg") ? (
                            <Line
                              type="monotone"
                              dataKey="avg"
                              name="avg"
                              stroke="#8B5CF6"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 3 }}
                            />
                          ) : null}

                          {selectedChartMetrics.includes("max") ? (
                            <Line
                              type="monotone"
                              dataKey="max"
                              name="max"
                              stroke="#DDD6FE"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 3 }}
                            />
                          ) : null}

                          {selectedChartMetrics.includes("yieldRatioPct") ? (
                            <Line
                              type="monotone"
                              dataKey="yieldRatioPct"
                              name="yieldRatioPct"
                              stroke="#6D28D9"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 3 }}
                            />
                          ) : null}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                        No historical chart points available yet.
                      </div>
                    )}
                  </div>

                  <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                    This is now a real trend chart using the historical archive dataset.
                    Next pass can improve it further with dual-axis support, custom date
                    selection, zoom controls, and richer metric scaling behavior.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}