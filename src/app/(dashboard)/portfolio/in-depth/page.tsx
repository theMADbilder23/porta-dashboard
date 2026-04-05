"use client";

import { useEffect, useMemo, useState } from "react";

type Timeframe = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

type PortfolioInDepthResponse = {
  timeframe: Timeframe;
  metric_label: string;
  sufficient_data: boolean;
  minimum_required_rows: number;
  actual_rows: number;
  latest_metric_date?: string | null;
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
  };
  period_header?: {
    timeframe: Timeframe;
    yield_label: string;
    avg_portfolio_value: number;
    total_yield_flow: number;
    total_claimable_usd: number;
    apy_ratio: number;
    current_claimable_usd: number;
    latest_metric_date: string | null;
    latest_metric_time?: string | null;
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

function getTimeframeYieldWord(timeframe: Timeframe) {
  switch (timeframe) {
    case "weekly":
      return "Weekly Yield Flow";
    case "monthly":
      return "Monthly Yield Flow";
    case "quarterly":
      return "Quarterly Yield Flow";
    case "yearly":
      return "Yearly Yield Flow";
    case "daily":
    default:
      return "Current DYF";
  }
}

export default function PortfolioInDepthPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [data, setData] = useState<PortfolioInDepthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const current = data?.summary.current;
  const historical = data?.summary.historical;
  const periodHeader = data?.period_header;
  const trend = data?.trend ?? [];

  const strongestDay = useMemo(() => {
    if (!trend.length) return null;
    return [...trend].sort(
      (a, b) => safeNumber(b.total_daily_yield_flow) - safeNumber(a.total_daily_yield_flow)
    )[0];
  }, [trend]);

  const weakestDay = useMemo(() => {
    if (!trend.length) return null;
    return [...trend].sort(
      (a, b) => safeNumber(a.total_daily_yield_flow) - safeNumber(b.total_daily_yield_flow)
    )[0];
  }, [trend]);

  const timeframeOptions: Timeframe[] = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
  ];

  const isDaily = timeframe === "daily";

  const topCards = useMemo(() => {
    if (isDaily) {
      return [
        {
          label: "Current TPV",
          value: formatCurrency(current?.total_portfolio_value ?? 0),
          sublabel: `Latest bucket: ${formatDateTimeLabel(
            current?.metric_time ?? periodHeader?.latest_metric_time ?? null
          )}`,
          tooltip:
            "Latest available intraday portfolio value bucket from the stored daily session.",
        },
        {
          label: "Current Claimable",
          value: formatCurrency(current?.total_claimable_usd ?? 0),
          sublabel: "Latest stored intraday claimable value.",
          tooltip:
            "Latest available claimable USD from the most recent stored intraday bucket.",
        },
        {
          label: "Current DYF",
          value: formatCurrency(current?.total_daily_yield_flow ?? 0),
          sublabel: "Latest stored daily yield flow bucket.",
          tooltip:
            "Current daily yield flow from the most recent stored intraday bucket for the latest available daily session.",
        },
        {
          label: "Yield / TVD",
          value: formatRatioPercent(current?.yield_tvd_ratio ?? 0),
          sublabel: "Latest intraday bucket ratio view.",
          tooltip:
            "Yield efficiency ratio from the latest intraday bucket.",
        },
      ];
    }

    return [
      {
        label: "Avg TPV",
        value: formatCurrency(periodHeader?.avg_portfolio_value ?? 0),
        sublabel: `Selected ${timeframe} average portfolio value.`,
        tooltip:
          "Average Total Portfolio Value across the selected stored timeframe rows.",
      },
      {
        label: periodHeader?.yield_label
          ? `Total ${periodHeader.yield_label}`
          : getTimeframeYieldWord(timeframe),
        value: formatCurrency(periodHeader?.total_yield_flow ?? 0),
        sublabel: `Total stored ${timeframe} yield flow.`,
        tooltip:
          "Summed yield flow across the selected stored timeframe rows.",
      },
      {
        label: "Total Claimable",
        value: formatCurrency(periodHeader?.total_claimable_usd ?? 0),
        sublabel: `Stored cumulative claimable across selected ${timeframe} period.`,
        tooltip:
          "Period claimable total built from stored rows using reset-aware accumulation logic.",
      },
      {
        label: "APY %",
        value: formatRatioPercent(periodHeader?.apy_ratio ?? 0),
        sublabel: "Period annualized yield estimate.",
        tooltip:
          "Annualized ratio based on total stored period yield flow relative to average TPV across the selected timeframe.",
      },
    ];
  }, [isDaily, current, periodHeader, timeframe]);

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
              ? "The daily view now loads the latest available intraday bucket set. No stored intraday buckets are available yet."
              : `This timeframe needs at least ${data.minimum_required_rows} stored day rows, but only ${data.actual_rows} are currently available.`}
          </p>
        </section>
      ) : null}

      {!isLoading && data && data.sufficient_data ? (
        <>
          <section className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
            {topCards.map((card) => (
              <MetricCard
                key={card.label}
                label={card.label}
                value={card.value}
                sublabel={card.sublabel}
                tooltip={card.tooltip}
              />
            ))}
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Metrics Table Overview
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                {isDaily
                  ? "Latest available intraday session summary from the stored bucket set."
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
                value={String(data.actual_rows)}
                sublabel={
                  isDaily
                    ? "30-minute buckets in latest stored intraday session"
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
                  ? "Latest available stored intraday bucket view. This gives an in-depth look at TPV, claimable totals, and current DYF context."
                  : "Clean historical review of stored daily metrics. This is the first layer of true Portfolio In-Depth intelligence and can be expanded later with search, charts, and date-specific drilldown."}
              </p>
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
                  {trend.map((row, index) => (
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
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}