"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { VChart } from "@visactor/react-vchart";
import type { ILineChartSpec } from "@visactor/vchart";
import { overviewTimeframeAtom } from "@/lib/atoms/overview";

type ApiRow = {
  snapshot_time: string;
  total_value_usd: number;
  total_claimable_usd: number;
};

type ChartSeriesName =
  | "Total Portfolio Value"
  | "Total Passive Income";

type ChartPoint = {
  label: string;
  value: number;
  series: ChartSeriesName;
};

type LineStyleDatum = {
  series?: ChartSeriesName;
};

function generateSpec(data: ChartPoint[]): ILineChartSpec {
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
    padding: [20, 24, 16, 12],
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
      style: (datum: LineStyleDatum) => {
        if (datum.series === "Total Portfolio Value") {
          return {
            stroke: "#500c95",
            lineWidth: 5,
          };
        }

        return {
          stroke: "#af59ff",
          lineWidth: 3,
          lineDash: [4, 4],
        };
      },
    },
    point: {
      state: {
        hover: {
          scaleX: 1.4,
          scaleY: 1.4,
        },
      },
      visible: true,
      style: (datum: LineStyleDatum) => ({
        fill:
          datum.series === "Total Portfolio Value"
            ? "#e1c2ff"
            : "#c084fc",
        stroke: "#0F0617",
        size: datum.series === "Total Portfolio Value" ? 8 : 5,
      }),
    },
    color: ["#500c95", "#af59ff"],
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

export default function Chart() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
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

        const transformed: ChartPoint[] = [];

        for (const row of rows) {
          const label = new Date(row.snapshot_time).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          transformed.push({
            label,
            value: Number(row.total_value_usd || 0),
            series: "Total Portfolio Value",
          });

          transformed.push({
            label,
            value: Number(row.total_claimable_usd || 0),
            series: "Total Passive Income",
          });
        }

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
  }, [timeframe]);

  const spec = useMemo(() => generateSpec(data), [data]);

  return <VChart spec={spec} />;
}