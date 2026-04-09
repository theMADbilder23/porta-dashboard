"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { VChart } from "@visactor/react-vchart";
import type { IBarChartSpec, ILineChartSpec } from "@visactor/vchart";
import { Info } from "lucide-react";
import {
  overviewSelectedMetricAtom,
  type OverviewMetricKey,
  overviewTimeframeAtom,
} from "@/lib/atoms/overview";
import { useOverview } from "@/hooks/use-overview";
import MetricCard from "./components/metric-card";

type PerformanceApiRow = {
  mode?: "daily_summary" | "trend";
  snapshot_time: string;
  label: string;
  metric_label?: string;

  total_value_usd?: number;
  total_claimable_usd?: number;
  total_pending_usd?: number;
  total_yield_flow_usd?: number;
  current_yield_flow_usd?: number;

  avg_total_value_usd?: number;
  min_total_value_usd?: number;
  max_total_value_usd?: number;

  avg_total_claimable_usd?: number;
  min_total_claimable_usd?: number;
  max_total_claimable_usd?: number;

  min_non_zero_total_claimable_usd?: number;

  metric_date?: string | null;
  metric_time?: string | null;
};

type ChartSeriesName =
  | "Total Portfolio Value"
  | "Realized Gains"
  | "Realized Losses"
  | "Total Passive Income";

type TrendPoint = {
  label: string;
  value: number;
  series: ChartSeriesName;
};

type DailyBarPoint = {
  label: string;
  value: number;
  series: ChartSeriesName;
};

type LineStyleDatum = {
  series?: ChartSeriesName;
};

type PerformanceStats = {
  current: number;
  min: number;
  avg: number;
  max: number;
  rangePct: number;
  upsidePct: number;
};

type StatMeta = {
  label: string;
  tooltipTitle?: string;
  description: string;
  value: number;
  isPercent?: boolean;
  helperText?: string;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAxisUsd(value: number) {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getSeriesName(metric: OverviewMetricKey): ChartSeriesName {
  switch (metric) {
    case "totalPortfolioValue":
      return "Total Portfolio Value";
    case "realizedGains":
      return "Realized Gains";
    case "realizedLosses":
      return "Realized Losses";
    case "totalPassiveIncome":
      return "Total Passive Income";
    default:
      return "Total Portfolio Value";
  }
}

function getSeriesColor(metric: OverviewMetricKey) {
  switch (metric) {
    case "totalPortfolioValue":
      return "#500c95";
    case "realizedGains":
      return "#844de2";
    case "realizedLosses":
      return "#eb77f6";
    case "totalPassiveIncome":
      return "#af59ff";
    default:
      return "#500c95";
  }
}

function getTrendValue(row: PerformanceApiRow, metric: OverviewMetricKey) {
  switch (metric) {
    case "totalPortfolioValue":
      return Number(row.total_value_usd || 0);
    case "realizedGains":
      return 0;
    case "realizedLosses":
      return 0;
    case "totalPassiveIncome":
      return Number(row.total_claimable_usd || 0);
    default:
      return Number(row.total_value_usd || 0);
  }
}

function getDailyStats(
  row: PerformanceApiRow,
  metric: OverviewMetricKey
): PerformanceStats {
  if (metric === "totalPortfolioValue") {
    const current = Number(row.total_value_usd || 0);
    const min = Number(row.min_total_value_usd ?? current);
    const avg = Number(row.avg_total_value_usd ?? current);
    const max = Number(row.max_total_value_usd ?? current);

    return {
      current,
      min,
      avg,
      max,
      rangePct: min > 0 ? ((max - min) / min) * 100 : 0,
      upsidePct: current > 0 ? ((max - current) / current) * 100 : 0,
    };
  }

  if (metric === "totalPassiveIncome") {
    const max = Number(row.max_total_claimable_usd ?? 0);
    const min = Number(
      row.min_non_zero_total_claimable_usd ??
        row.min_total_claimable_usd ??
        0
    );
    const current = Number(row.current_yield_flow_usd ?? max - min);
    const avg = Number(row.avg_total_claimable_usd ?? current);

    return {
      current,
      min,
      avg,
      max,
      rangePct: min > 0 ? ((max - min) / min) * 100 : 0,
      upsidePct: 0,
    };
  }

  return {
    current: 0,
    min: 0,
    avg: 0,
    max: 0,
    rangePct: 0,
    upsidePct: 0,
  };
}

function getTrendStats(points: TrendPoint[]): PerformanceStats {
  if (!points.length) {
    return {
      current: 0,
      min: 0,
      avg: 0,
      max: 0,
      rangePct: 0,
      upsidePct: 0,
    };
  }

  const values = points.map((point) => Number(point.value || 0));
  const current = values[values.length - 1] ?? 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg =
    values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

  return {
    current,
    min,
    avg,
    max,
    rangePct: min > 0 ? ((max - min) / min) * 100 : 0,
    upsidePct: current > 0 ? ((max - current) / current) * 100 : 0,
  };
}

function buildDailySummaryBars(
  row: PerformanceApiRow,
  metric: OverviewMetricKey
): DailyBarPoint[] {
  const stats = getDailyStats(row, metric);
  const series = getSeriesName(metric);

  return [
    { label: "Min", value: stats.min, series },
    { label: "Avg", value: stats.avg, series },
    { label: "Current", value: stats.current, series },
    { label: "Max", value: stats.max, series },
  ];
}

function getAxisLabelConfig(
  pointCount: number,
  timeframe: string
): {
  visible: boolean;
  formatter?: (text: unknown, datum?: unknown, index?: number) => string;
} {
  if (timeframe === "weekly") {
    const interval =
      pointCount > 120 ? 24 : pointCount > 84 ? 16 : pointCount > 56 ? 12 : 8;

    return {
      visible: true,
      formatter: (text: unknown, _datum?: unknown, index?: number) => {
        const safeText = typeof text === "string" ? text : "";
        if (typeof index !== "number") return safeText;
        return index % interval === 0 ? safeText : "";
      },
    };
  }

  if (timeframe === "monthly") {
    const interval = pointCount > 24 ? 3 : 2;
    return {
      visible: true,
      formatter: (text: unknown, _datum?: unknown, index?: number) => {
        const safeText = typeof text === "string" ? text : "";
        if (typeof index !== "number") return safeText;
        return index % interval === 0 ? safeText : "";
      },
    };
  }

  if (timeframe === "quarterly") {
    const interval = pointCount > 45 ? 6 : 4;
    return {
      visible: true,
      formatter: (text: unknown, _datum?: unknown, index?: number) => {
        const safeText = typeof text === "string" ? text : "";
        if (typeof index !== "number") return safeText;
        return index % interval === 0 ? safeText : "";
      },
    };
  }

  if (timeframe === "yearly") {
    const interval = pointCount > 90 ? 12 : 8;
    return {
      visible: true,
      formatter: (text: unknown, _datum?: unknown, index?: number) => {
        const safeText = typeof text === "string" ? text : "";
        if (typeof index !== "number") return safeText;
        return index % interval === 0 ? safeText : "";
      },
    };
  }

  return {
    visible: true,
    formatter: (text: unknown) => (typeof text === "string" ? text : ""),
  };
}

function generateLineSpec(
  data: TrendPoint[],
  metric: OverviewMetricKey,
  timeframe: string
): ILineChartSpec {
  const color = getSeriesColor(metric);
  const axisLabelConfig = getAxisLabelConfig(data.length, timeframe);

  return {
    type: "line",
    animation: false,
    data: [
      {
        id: "growthData",
        values: data,
      },
    ],
    xField: "label",
    yField: "value",
    seriesField: "series",
    padding: [18, 24, 26, 12],
    legends: {
      visible: true,
      position: "start",
      orient: "top",
      item: {
        label: {
          style: {
            fill: "#C4B5FD",
            fontSize: 14,
            fontWeight: 600,
          },
        },
      },
    },
    axes: [
      {
        orient: "left",
        label: {
          formatMethod: (text) => formatAxisUsd(Number(text)),
          style: {
            fill: "#A78BFA",
          },
        },
        title: {
          visible: true,
          text: "USD",
          style: {
            fill: "#A78BFA",
            fontSize: 12,
          },
        },
        grid: {
          visible: true,
          style: {
            stroke: "#241533",
            lineWidth: 1,
          },
        },
      },
      {
        orient: "bottom",
        label: {
          visible: axisLabelConfig.visible,
          formatMethod: axisLabelConfig.formatter as never,
          style: {
            fill: "#A78BFA",
            fontSize: 11,
          },
          flush: true,
        },
      },
    ],
    line: {
      state: {
        hover: {
          lineWidth: 5,
        },
      },
      style: (_datum: LineStyleDatum) => ({
        stroke: color,
        lineWidth: 3,
      }),
    },
    point: {
      state: {
        hover: {
          scaleX: 1.2,
          scaleY: 1.2,
        },
      },
      visible: data.length <= 72,
      style: (_datum: LineStyleDatum) => ({
        fill: "#e1c2ff",
        stroke: "#0F0617",
        size: 4,
      }),
    },
    color: [color],
    tooltip: {
      visible: true,
      mark: {
        title: {
          value: (datum) => String(datum?.label ?? ""),
        },
        content: [
          {
            key: (datum) => String(datum?.series ?? ""),
            value: (datum) => formatUsd(Number(datum?.value ?? 0)),
          },
        ],
      },
    },
    crosshair: {
      xField: {
        visible: true,
        line: {
          type: "line",
          style: {
            stroke: "#3B2A54",
            lineWidth: 1,
          },
        },
      },
    },
    background: "transparent",
  };
}

function generateBarSpec(
  data: DailyBarPoint[],
  metric: OverviewMetricKey
): IBarChartSpec {
  const color = getSeriesColor(metric);

  return {
    type: "bar",
    animation: false,
    data: [
      {
        id: "dailySummary",
        values: data,
      },
    ],
    xField: "label",
    yField: "value",
    seriesField: "series",
    padding: [18, 24, 22, 12],
    legends: {
      visible: true,
      position: "start",
      orient: "top",
      item: {
        label: {
          style: {
            fill: "#C4B5FD",
            fontSize: 14,
            fontWeight: 600,
          },
        },
      },
    },
    axes: [
      {
        orient: "left",
        label: {
          formatMethod: (text) => formatAxisUsd(Number(text)),
          style: {
            fill: "#A78BFA",
          },
        },
        title: {
          visible: true,
          text: "USD",
          style: {
            fill: "#A78BFA",
            fontSize: 12,
          },
        },
        grid: {
          visible: true,
          style: {
            stroke: "#241533",
            lineWidth: 1,
          },
        },
      },
      {
        orient: "bottom",
        label: {
          style: {
            fill: "#A78BFA",
          },
        },
      },
    ],
    bar: {
      style: {
        fill: color,
        cornerRadius: 6,
        width: 26,
        maxWidth: 26,
      },
      state: {
        hover: {
          fillOpacity: 0.9,
        },
      },
    },
    color: [color],
    tooltip: {
      visible: true,
      mark: {
        title: {
          value: (datum) => String(datum?.label ?? ""),
        },
        content: [
          {
            key: (datum) => String(datum?.series ?? ""),
            value: (datum) => formatUsd(Number(datum?.value ?? 0)),
          },
        ],
      },
    },
    background: "transparent",
  };
}

function InfoTooltip({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground transition-colors group-hover:text-foreground" />
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-border bg-background/95 p-3 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        <div className="text-xs font-medium text-foreground">{title}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </div>
      </div>
    </div>
  );
}

function shouldWarnStat(_label: string, _value: number, _isPercent?: boolean) {
  return false;
}

export default function Chart() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const selectedMetric = useAtomValue(overviewSelectedMetricAtom);
  const { data: overview } = useOverview(timeframe);

  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [dailySummary, setDailySummary] = useState<PerformanceApiRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/performance?timeframe=${timeframe}`, {
          cache: "no-store",
        });
        const rows: PerformanceApiRow[] = await res.json();

        if (!Array.isArray(rows) || rows.length === 0) {
          if (!cancelled) {
            setTrendData([]);
            setDailySummary(null);
          }
          return;
        }

        if (timeframe === "daily" && rows[0]?.mode === "daily_summary") {
          if (!cancelled) {
            setDailySummary(rows[0]);
            setTrendData([]);
          }
          return;
        }

        const seriesName = getSeriesName(selectedMetric);

        const transformed: TrendPoint[] = rows.map((row) => ({
          label: row.label,
          value: getTrendValue(row, selectedMetric),
          series: seriesName,
        }));

        if (!cancelled) {
          setTrendData(transformed);
          setDailySummary(null);
        }
      } catch {
        if (!cancelled) {
          setTrendData([]);
          setDailySummary(null);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [timeframe, selectedMetric]);

  const stats = useMemo(() => {
    if (timeframe === "daily" && dailySummary) {
      return getDailyStats(dailySummary, selectedMetric);
    }

    return getTrendStats(trendData);
  }, [timeframe, dailySummary, trendData, selectedMetric]);

  const yieldToTvdPct = useMemo(() => {
    if (selectedMetric !== "totalPassiveIncome") return 0;

    const flow = Number(overview?.passive_income || 0);
    const tvd = Number(overview?.total_value_distributed || 0);

    if (tvd <= 0) return 0;
    return (flow / tvd) * 100;
  }, [overview, selectedMetric]);

  const statCards = useMemo<StatMeta[]>(() => {
    if (selectedMetric === "totalPassiveIncome") {
      return [
        {
          label: "Current",
          tooltipTitle: `Current ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Yield Earned`,
          description:
            "Estimated yield flow earned during the selected timeframe, calculated from the claimable yield range.",
          value: stats.current,
          helperText: "current yield flow",
        },
        {
          label: "Min",
          tooltipTitle: "Min Claimable Yield",
          description:
            "Lowest claimable yield observed across the selected timeframe snapshots.",
          value: stats.min,
          helperText: "lowest reading",
        },
        {
          label: "Avg",
          tooltipTitle: "Avg Claimable Yield",
          description:
            "Average claimable yield balance across the selected timeframe snapshots.",
          value: stats.avg,
          helperText: "average reading",
        },
        {
          label: "Max",
          tooltipTitle: "Max Claimable Yield",
          description:
            "Highest claimable yield observed across the selected timeframe snapshots.",
          value: stats.max,
          helperText: "highest reading",
        },
        {
          label: "Min → Max",
          tooltipTitle: "Min → Max Claimable Yield % Increase",
          description:
            "Percentage increase from the lowest to the highest claimable yield over the selected timeframe.",
          value: stats.rangePct,
          isPercent: true,
          helperText: "range expansion",
        },
        {
          label: "Yield / TVD",
          tooltipTitle: "Yield / TVD %",
          description:
            "Current yield flow as a percentage of Total Value Distributed. This shows how much yield the distributed capital generated during the selected timeframe.",
          value: yieldToTvdPct,
          isPercent: true,
          helperText: "yield efficiency",
        },
      ];
    }

    return [
      {
        label: "Current",
        description:
          "Most recent portfolio value captured in the selected timeframe.",
        value: stats.current,
        helperText: "latest reading",
      },
      {
        label: "Min",
        description:
          "Lowest portfolio value recorded in the selected timeframe.",
        value: stats.min,
        helperText: "period floor",
      },
      {
        label: "Avg",
        description:
          "Average portfolio value across the selected timeframe.",
        value: stats.avg,
        helperText: "period average",
      },
      {
        label: "Max",
        description:
          "Highest portfolio value recorded in the selected timeframe.",
        value: stats.max,
        helperText: "period peak",
      },
      {
        label: "Min → Max",
        description:
          "Percentage increase from the lowest to the highest portfolio value in the selected timeframe.",
        value: stats.rangePct,
        isPercent: true,
        helperText: "total range",
      },
      {
        label: "Current → Max",
        description:
          "Potential upside from the current portfolio value to the highest value recorded in the selected timeframe.",
        value: stats.upsidePct,
        isPercent: true,
        helperText: "remaining upside",
      },
    ];
  }, [selectedMetric, stats, timeframe, yieldToTvdPct]);

  const spec = useMemo(() => {
    if (timeframe === "daily" && dailySummary) {
      return generateBarSpec(
        buildDailySummaryBars(dailySummary, selectedMetric),
        selectedMetric
      );
    }

    return generateLineSpec(trendData, selectedMetric, timeframe);
  }, [timeframe, dailySummary, trendData, selectedMetric]);

  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {card.label}
              </span>
              <InfoTooltip
                title={card.tooltipTitle ?? card.label}
                description={card.description}
              />
            </div>

            <MetricCard
              title={card.label}
              value={card.value}
              color={getSeriesColor(selectedMetric)}
              isPercent={card.isPercent}
              helperText={card.helperText}
              warning={shouldWarnStat(card.label, card.value, card.isPercent)}
              className="min-w-[132px] md:min-w-[146px]"
            />
          </div>
        ))}
      </div>

      <div className="relative h-[400px] w-full flex-1">
        <VChart spec={spec} />
      </div>
    </section>
  );
}