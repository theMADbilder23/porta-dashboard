"use client";

import { useEffect, useMemo, useState } from "react";

type Timeframe = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

type PortfolioInDepthResponse = {
  timeframe: Timeframe;
  metric_label: string;
  sufficient_data: boolean;
  minimum_required_rows: number;
  actual_rows: number;
  summary: {
    current: {
      metric_date: string | null;
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
  trend: Array<{
    metric_date: string;
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
}: {
  label: string;
  value: string;
  sublabel?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[#F8F4FF] p-4 dark:bg-[#140D20]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-semibold ${
          emphasis
            ? "text-[#6D28D9] dark:text-[#D8B4FE]"
            : "text-[#2D1B45] dark:text-[#F3E8FF]"
        }`}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">{sublabel}</p>
      ) : null}
    </div>
  );
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
            Not enough historical data yet
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            This timeframe needs at least {data.minimum_required_rows} stored day
            rows, but only {data.actual_rows} are currently available.
          </p>
        </section>
      ) : null}

      {!isLoading && data && data.sufficient_data ? (
        <>
          <section className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
            <MetricCard
              label="Current TPV"
              value={formatCurrency(current?.total_portfolio_value ?? 0)}
              sublabel={`Latest stored date: ${formatDateLabel(current?.metric_date ?? null)}`}
              tooltip="Latest stored Total Portfolio Value from the derived historical metrics table."
            />

            <MetricCard
              label="Current Claimable"
              value={formatCurrency(current?.total_claimable_usd ?? 0)}
              sublabel="Latest stored total claimable value."
              tooltip="Latest stored total claimable USD from the finalized daily metrics table."
            />

            <MetricCard
              label="Current DYF"
              value={formatCurrency(current?.total_daily_yield_flow ?? 0)}
              sublabel="Latest stored daily yield flow."
              tooltip="Stored daily yield flow for the selected period’s latest finalized day."
            />

            <MetricCard
              label="Yield / TVD"
              value={formatRatioPercent(current?.yield_tvd_ratio ?? 0)}
              sublabel="Latest stored yield efficiency ratio."
              tooltip="Stored ratio between yield and distributed value for the latest finalized day."
            />
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Historical Claimable & DYF Review
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                Stored historical review of the Overview math. This section gives
                a compact, searchable summary of claimable behavior, DYF range,
                and yield efficiency across the selected timeframe.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 laptop:grid-cols-4 desktop:grid-cols-8">
              <CompactStat
                label="Min Claimable"
                value={formatCurrency(historical?.min_claimable_usd ?? 0)}
              />
              <CompactStat
                label="Avg Claimable"
                value={formatCurrency(historical?.avg_claimable_usd ?? 0)}
              />
              <CompactStat
                label="Max Claimable"
                value={formatCurrency(historical?.max_claimable_usd ?? 0)}
              />
              <CompactStat
                label="Claimable Range"
                value={formatPercent(historical?.range_claimable_pct ?? 0)}
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
              <CompactStat
                label="Avg Yield / TVD"
                value={formatRatioPercent(historical?.avg_yield_tvd_ratio ?? 0)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Period Highlights
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                Compact highlight strip for the strongest and weakest yield-flow
                days, stored row coverage, and the overall TPV range across the
                selected historical window.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
              <CompactStat
                label="Strongest DYF Day"
                value={strongestDay ? strongestDay.label : "—"}
                sublabel={
                  strongestDay
                    ? formatCurrency(strongestDay.total_daily_yield_flow)
                    : "No data"
                }
                emphasis
              />
              <CompactStat
                label="Weakest DYF Day"
                value={weakestDay ? weakestDay.label : "—"}
                sublabel={
                  weakestDay
                    ? formatCurrency(weakestDay.total_daily_yield_flow)
                    : "No data"
                }
              />
              <CompactStat
                label="Period TPV Range"
                value={formatPercent(historical?.range_portfolio_pct ?? 0)}
                sublabel={`Min ${formatCompactCurrency(
                  historical?.min_portfolio_value ?? 0
                )} → Max ${formatCompactCurrency(
                  historical?.max_portfolio_value ?? 0
                )}`}
              />
              <CompactStat
                label="Stored Rows"
                value={String(data.actual_rows)}
                sublabel={`Minimum required: ${data.minimum_required_rows}`}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Historical Metrics Table
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                Clean historical review of stored daily metrics. This is the
                first layer of true Portfolio In-Depth intelligence and can be
                expanded later with search, charts, and date-specific drilldown.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E9DAFF] dark:border-[#312047]">
              <table className="min-w-full text-left">
                <thead className="bg-[#F6F0FF] dark:bg-[#140D20]">
                  <tr className="border-b border-[#F0E8FF] dark:border-[#241533]">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Date
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
                  {trend.map((row) => (
                    <tr
                      key={row.metric_date}
                      className="border-b border-[#F7F1FF] dark:border-[#1C1328]"
                    >
                      <td className="px-4 py-4 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatDateLabel(row.metric_date)}
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