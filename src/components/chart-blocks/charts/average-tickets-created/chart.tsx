"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { VChart } from "@visactor/react-vchart";
import type { IBarChartSpec, ILineChartSpec } from "@visactor/vchart";
import {
  overviewSelectedMetricAtom,
  type OverviewMetricKey,
  overviewTimeframeAtom,
} from "@/lib/atoms/overview";

type PerformanceApiRow = {
  mode?: "daily_summary" | "trend";
  snapshot_time: string;
  label: string;

  total_value_usd?: number;
  total_claimable_usd?: number;

  avg_total_value_usd?: number;
  min_total_value_usd?: number;
  max_total_value_usd?: number;
  net_change_total_value_usd?: number;
  avg_change_total_value_pct?: number;
  volatility_total_value_usd?: number;

  avg_total_claimable_usd?: number;
  min_total_claimable_usd?: number;
  max_total_claimable_usd?: number;
  net_change_total_claimable_usd?: number;
  avg_change_total_claimable_pct?: number;
  volatility_total_claimable_usd?: number;

  snapshot_count?: number;
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

function buildDailySummaryBars(
  row: PerformanceApiRow,
  metric: OverviewMetricKey
): DailyBarPoint[] {
  const series = getSeriesName(metric);

  if (metric === "totalPortfolioValue") {
    return [
      { label: "Min", value: Number(row.min_total_value_usd || 0), series },
      { label: "Avg", value: Number(row.avg_total_value_usd || 0), series },
      { label: "Current", value: Number(row.total_value_usd || 0), series },
      { label: "Max", value: Number(row.max_total_value_usd || 0), series },
    ];
  }

  if (metric === "totalPassiveIncome") {
    return [
      { label: "Min", value: Number(row.min_total_claimable_usd || 0), series },
      { label: "Avg", value: Number(row.avg_total_claimable_usd || 0), series },
      { label: "Current", value: Number(row.total_claimable_usd || 0), series },
      { label: "Max", value: Number(row.max_total_claimable_usd || 0), series },
    ];
  }

  return [
    { label: "Min", value: 0, series },
    { label: "Avg", value: 0, series },
    { label: "Current", value: 0, series },
    { label: "Max", value: 0, series },
  ];
}

function generateLineSpec(
  data: TrendPoint[],
  metric: OverviewMetricKey
): ILineChartSpec {
  const color = getSeriesColor(metric);

  return {
    type: "line",
    data: [
      {
        id: "growthData",
        values: data,
      },
    ],
    xField: "label",
    yField: "value",
    seriesField: "series",
    padding: [20, 24, 24, 16],
    legends: {
      visible: true,
      position: "start",
      orient: "top",
      item: {
        label: {
          style: {
            fill: "#C4B5FD",
          },
        },
      },
    },
    axes: [
      {
        orient: "left",
        label: {
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
    line: {
      state: {
        hover: {
          lineWidth: 6,
        },
      },
      style: (_datum: LineStyleDatum) => ({
        stroke: color,
        lineWidth: 4,
      }),
    },
    point: {
      state: {
        hover: {
          scaleX: 1.4,
          scaleY: 1.4,
        },
      },
      visible: true,
      style: (_datum: LineStyleDatum) => ({
        fill: "#e1c2ff",
        stroke: "#0F0617",
        size: 7,
      }),
    },
    color: [color],
    tooltip: {
      visible: true,
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
    data: [
      {
        id: "dailySummary",
        values: data,
      },
    ],
    xField: "label",
    yField: "value",
    seriesField: "series",
    padding: [20, 24, 24, 16],
    legends: {
      visible: true,
      position: "start",
      orient: "top",
      item: {
        label: {
          style: {
            fill: "#C4B5FD",
          },
        },
      },
    },
    axes: [
      {
        orient: "left",
        label: {
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
    },
    background: "transparent",
  };
}

export default function Chart() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const selectedMetric = useAtomValue(overviewSelectedMetricAtom);

  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [dailySummary, setDailySummary] = useState<PerformanceApiRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/performance?timeframe=${timeframe}`);
        const rows: PerformanceApiRow[] = await res.json();

        if (!Array.isArray(rows) || rows.length === 0) {
          if (!cancelled) {
            setTrendData([]);
            setDailySummary(null);
          }
          return;
        }

        const firstRow = rows[0];

        if (timeframe === "daily" && firstRow.mode === "daily_summary") {
          if (!cancelled) {
            setDailySummary(firstRow);
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

  const spec = useMemo(() => {
    if (timeframe === "daily" && dailySummary) {
      return generateBarSpec(
        buildDailySummaryBars(dailySummary, selectedMetric),
        selectedMetric
      );
    }

    return generateLineSpec(trendData, selectedMetric);
  }, [timeframe, dailySummary, trendData, selectedMetric]);

  return <VChart spec={spec} />;
}