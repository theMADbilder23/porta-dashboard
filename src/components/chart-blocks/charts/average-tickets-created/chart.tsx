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

type ChartPoint = {
  label: string;
  value: number;
  series:
    | "Total Portfolio Value"
    | "Total Passive Income";
};

function generateSpec(data: ChartPoint[]): ILineChartSpec {
  return {
    type: "line",
    data: [{ id: "growthData", values: data }],
    xField: "label",
    yField: "value",
    seriesField: "series",
    padding: [20, 24, 16, 12],
    legends: { visible: true },
    axes: [{ orient: "left" }, { orient: "bottom" }],
    line: {
      style: (d: any) => ({
        stroke:
          d.series === "Total Portfolio Value"
            ? "#500c95"
            : "#af59ff",
        lineWidth: d.series === "Total Portfolio Value" ? 4 : 3,
      }),
    },
    point: { visible: true },
    background: "transparent",
  };
}

export default function Chart() {
  const timeframe = useAtomValue(overviewTimeframeAtom);

  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/performance?timeframe=${timeframe}`);
      const rows: ApiRow[] = await res.json();

      const transformed: ChartPoint[] = [];

      rows.forEach((row) => {
        const label = new Date(row.snapshot_time).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        transformed.push({
          label,
          value: row.total_value_usd,
          series: "Total Portfolio Value",
        });

        transformed.push({
          label,
          value: row.total_claimable_usd,
          series: "Total Passive Income",
        });
      });

      setData(transformed);
    }

    load();
  }, [timeframe]);

  const spec = useMemo(() => generateSpec(data), [data]);

  return <VChart spec={spec} />;
}