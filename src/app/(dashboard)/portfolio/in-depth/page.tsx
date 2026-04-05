"use client";

import { useEffect, useMemo, useState } from "react";

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

type PortfolioInDepthResponse = {
  timeframe: Timeframe;
  metric_label: string;
  sufficient_data: boolean;
  minimum_required_rows: number;
  actual_rows: number;
  summary: {
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
};

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
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

function getRowSearchText(
  row: PortfolioInDepthResponse["trend"][number],
  isDaily: boolean
) {
  const dateText = row.metric_date || "";
  const timeText = row.metric_time || "";
  const labelText = row.label || "";

  return [dateText, timeText, labelText].join(" ").toLowerCase();
}

function getRowSortValue(
  row: PortfolioInDepthResponse["trend"][number],
  field: SortField,
  isDaily: boolean
) {
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
  }, [timeframe]);

  const current = data?.summary.current;
  const historical = data?.summary.historical;
  const timeframeSummary = data?.summary.timeframe_summary;
  const trend = data?.trend ?? [];

  const timeframeOptions: Timeframe[] = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
  ];

  const isDaily = timeframe === "daily";

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
          timeframeSummary?.claimable_reset_count && timeframeSummary.claimable_reset_count > 0
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

  return (
    <div className="min-h-screen space-y-6 p-6">
      <section className="rounded-2xl border border-[#E9DAFF] bg-gradient-to-br from-white to-[#F8F4FF] p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
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
              ? "The daily view now shows live 30-minute portfolio snapshot buckets for the current UTC day. No buckets are available yet."
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
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Metrics Table Overview
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                {isDaily
                  ? "Live in-day summary of the current UTC day’s 30-minute bucket set."
                  : "Summary layer for the currently selected historical dataset. This panel shows the minimum, average, and maximum values found inside the metrics table for the selected timeframe."}
              </p>
            </div>

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
            <div className="flex flex-col gap-1.5 desktop:flex-row desktop:items-end desktop:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                  Period Highlights
                </h2>
                <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                  Quick scan of the strongest and weakest yield-flow entries, row coverage, and TPV range.
                </p>
              </div>
            </div>

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

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Historical Metrics Table
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                {isDaily
                  ? "Live 30-minute bucket view for the current UTC day. This gives an in-depth intraday look at TPV, claimable totals, and current DYF context."
                  : "Clean historical review of stored daily metrics. This now includes search and sort controls so larger row sets stay useful as history expands."}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-[#E9DAFF] p-4 dark:border-[#312047]">
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

            <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E9DAFF] dark:border-[#312047]">
              <table className="min-w-full text-left">
                <thead className="bg-[#F6F0FF] dark:bg-[#140D20]">
                  <tr className="border-b border-[#F0E8FF] dark:border-[#241533]">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      {isDaily ? "Snapshot Time" : "Date"}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      TPV
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Claimable
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      DYF
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Min
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Avg
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Max
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Yield / TVD
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {displayTrend.map((row, index) => (
                    <tr
                      key={row.metric_time || `${row.metric_date}-${index}`}
                      className="border-b border-[#F7F1FF] dark:border-[#1C1328]"
                    >
                      <td className="px-4 py-4 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                        {isDaily
                          ? formatDateTimeLabel(row.metric_time ?? null)
                          : formatDateLabel(row.metric_date)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCurrency(row.total_portfolio_value)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCurrency(row.total_claimable_usd)}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-[#6D28D9] dark:text-[#D8B4FE]">
                        {formatCurrency(row.total_daily_yield_flow)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCurrency(row.min_claimable_usd)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCurrency(row.avg_claimable_usd)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCurrency(row.max_claimable_usd)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
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
          </section>
        </>
      ) : null}
    </div>
  );
}