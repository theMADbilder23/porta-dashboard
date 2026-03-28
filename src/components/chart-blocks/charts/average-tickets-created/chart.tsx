"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { VChart } from "@visactor/react-vchart";
import type { ILineChartSpec } from "@visactor/vchart";
import {
  overviewSelectedMetricAtom,
  type OverviewMetricKey,
  overviewTimeframeAtom,
} from "@/lib/atoms/overview";

type ApiRow = {
  snapshot_time: string;
  label: string;
  total_value_usd: number;
  total_claimable_usd: number;
};

type ChartSeriesName =
  | "Total Portfolio Value"
  | "Realized Gains"
  | "Realized Losses"
  | "Total Passive Income";

type ChartPoint = {
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

function getSeriesValue(row: ApiRow, metric: OverviewMetricKey) {
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

function formatUsdCompact(value: number) {
  return `$${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function generateSpec(data: ChartPoint[], metric: OverviewMetricKey): ILineChartSpec {
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
          formatMethod: (value: string | number) => {
            const numericValue = Number(value);
            if (!Number.isFinite(numericValue)) return "USD";
            return formatUsdCompact(numericValue);
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
      mark: {
        title: {
          value: (datum: { label?: string }) => datum?.label || "",
        },
        content: [
          {
            key: (datum: { series?: string }) => datum?.series || "",
            value: (datum: { value?: number }) =>
              `${formatUsdCompact(Number(datum?.value || 0))} USD`,
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

export default function Chart() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const selectedMetric = useAtomValue(overviewSelectedMetricAtom);
  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/performance?timeframe=${timeframe}`);
        const rows: ApiRow[] = await res.json();

        if (!Array.isArray(rows)) {
          if (!cancelled) {
            setData([]);
          }
          return;
        }

        const seriesName = getSeriesName(selectedMetric);

        const transformed: ChartPoint[] = rows.map((row) => ({
          label: row.label,
          value: getSeriesValue(row, selectedMetric),
          series: seriesName,
        }));

        if (!cancelled) {
          setData(transformed);
        }
      } catch {
        if (!cancelled) {
          setData([]);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [timeframe, selectedMetric]);

  const spec = useMemo(
    () => generateSpec(data, selectedMetric),
    [data, selectedMetric]
  );

  return <VChart spec={spec} />;
}