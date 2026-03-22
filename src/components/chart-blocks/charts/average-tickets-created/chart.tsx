"use client";

import { useAtomValue } from "jotai";
import { VChart } from "@visactor/react-vchart";
import type { ILineChartSpec } from "@visactor/vchart";
import { overviewTimeframeAtom, type OverviewTimeframe } from "@/lib/atoms/overview";

type GrowthPoint = {
  label: string;
  value: number;
  series: "Portfolio Value" | "Realized Gains";
};

const growthDataByTimeframe: Record<OverviewTimeframe, GrowthPoint[]> = {
  daily: [
    { label: "Mon", value: 24208, series: "Portfolio Value" },
    { label: "Tue", value: 24480, series: "Portfolio Value" },
    { label: "Wed", value: 24620, series: "Portfolio Value" },
    { label: "Thu", value: 24540, series: "Portfolio Value" },
    { label: "Fri", value: 24880, series: "Portfolio Value" },

    { label: "Mon", value: 4564, series: "Realized Gains" },
    { label: "Tue", value: 4620, series: "Realized Gains" },
    { label: "Wed", value: 4705, series: "Realized Gains" },
    { label: "Thu", value: 4680, series: "Realized Gains" },
    { label: "Fri", value: 4820, series: "Realized Gains" },
  ],
  weekly: [
    { label: "W1", value: 24980, series: "Portfolio Value" },
    { label: "W2", value: 25320, series: "Portfolio Value" },
    { label: "W3", value: 25760, series: "Portfolio Value" },
    { label: "W4", value: 26240, series: "Portfolio Value" },

    { label: "W1", value: 5140, series: "Realized Gains" },
    { label: "W2", value: 5480, series: "Realized Gains" },
    { label: "W3", value: 5710, series: "Realized Gains" },
    { label: "W4", value: 5935, series: "Realized Gains" },
  ],
  monthly: [
    { label: "Jan", value: 26420, series: "Portfolio Value" },
    { label: "Feb", value: 27100, series: "Portfolio Value" },
    { label: "Mar", value: 27980, series: "Portfolio Value" },
    { label: "Apr", value: 28640, series: "Portfolio Value" },
    { label: "May", value: 29420, series: "Portfolio Value" },
    { label: "Jun", value: 30180, series: "Portfolio Value" },

    { label: "Jan", value: 8240, series: "Realized Gains" },
    { label: "Feb", value: 8510, series: "Realized Gains" },
    { label: "Mar", value: 8940, series: "Realized Gains" },
    { label: "Apr", value: 9360, series: "Realized Gains" },
    { label: "May", value: 9780, series: "Realized Gains" },
    { label: "Jun", value: 10140, series: "Realized Gains" },
  ],
  quarterly: [
    { label: "Q1", value: 31880, series: "Portfolio Value" },
    { label: "Q2", value: 33720, series: "Portfolio Value" },
    { label: "Q3", value: 35460, series: "Portfolio Value" },
    { label: "Q4", value: 37240, series: "Portfolio Value" },

    { label: "Q1", value: 14920, series: "Realized Gains" },
    { label: "Q2", value: 16240, series: "Realized Gains" },
    { label: "Q3", value: 17480, series: "Realized Gains" },
    { label: "Q4", value: 18860, series: "Realized Gains" },
  ],
  yearly: [
    { label: "2021", value: 46300, series: "Portfolio Value" },
    { label: "2022", value: 51980, series: "Portfolio Value" },
    { label: "2023", value: 60420, series: "Portfolio Value" },
    { label: "2024", value: 71880, series: "Portfolio Value" },
    { label: "2025", value: 84640, series: "Portfolio Value" },

    { label: "2021", value: 28500, series: "Realized Gains" },
    { label: "2022", value: 32140, series: "Realized Gains" },
    { label: "2023", value: 36980, series: "Realized Gains" },
    { label: "2024", value: 42120, series: "Realized Gains" },
    { label: "2025", value: 48600, series: "Realized Gains" },
  ],
};

function generateSpec(data: GrowthPoint[]): ILineChartSpec {
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
      style: {
        lineWidth: 3,
      },
    },
    point: {
      visible: true,
      style: {
        size: 7,
        lineWidth: 2,
        fillOpacity: 1,
      },
    },
    color: ["#A855F7", "#7C3AED"],
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
  const data = growthDataByTimeframe[timeframe];
  const spec = generateSpec(data);

  return <VChart spec={spec} />;
}