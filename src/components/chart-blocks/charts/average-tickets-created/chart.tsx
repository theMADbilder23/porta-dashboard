"use client";

import { useAtomValue } from "jotai";
import { VChart } from "@visactor/react-vchart";
import type { ILineChartSpec } from "@visactor/vchart";
import { overviewTimeframeAtom, type OverviewTimeframe } from "@/lib/atoms/overview";

type GrowthPoint = {
  label: string;
  value: number;
  series:
    | "Total Portfolio Value"
    | "Realized Gains"
    | "Realized Losses"
    | "Total Passive Income";
};

const growthDataByTimeframe: Record<OverviewTimeframe, GrowthPoint[]> = {
  daily: [
    { label: "Mon", value: 24208, series: "Total Portfolio Value" },
    { label: "Tue", value: 24480, series: "Total Portfolio Value" },
    { label: "Wed", value: 24620, series: "Total Portfolio Value" },
    { label: "Thu", value: 24540, series: "Total Portfolio Value" },
    { label: "Fri", value: 24880, series: "Total Portfolio Value" },

    { label: "Mon", value: 4564, series: "Realized Gains" },
    { label: "Tue", value: 4620, series: "Realized Gains" },
    { label: "Wed", value: 4705, series: "Realized Gains" },
    { label: "Thu", value: 4680, series: "Realized Gains" },
    { label: "Fri", value: 4820, series: "Realized Gains" },

    { label: "Mon", value: 1218, series: "Realized Losses" },
    { label: "Tue", value: 1265, series: "Realized Losses" },
    { label: "Wed", value: 1190, series: "Realized Losses" },
    { label: "Thu", value: 1238, series: "Realized Losses" },
    { label: "Fri", value: 1210, series: "Realized Losses" },

    { label: "Mon", value: 312, series: "Total Passive Income" },
    { label: "Tue", value: 326, series: "Total Passive Income" },
    { label: "Wed", value: 338, series: "Total Passive Income" },
    { label: "Thu", value: 351, series: "Total Passive Income" },
    { label: "Fri", value: 367, series: "Total Passive Income" },
  ],

  weekly: [
    { label: "W1", value: 24980, series: "Total Portfolio Value" },
    { label: "W2", value: 25320, series: "Total Portfolio Value" },
    { label: "W3", value: 25760, series: "Total Portfolio Value" },
    { label: "W4", value: 26240, series: "Total Portfolio Value" },

    { label: "W1", value: 5140, series: "Realized Gains" },
    { label: "W2", value: 5480, series: "Realized Gains" },
    { label: "W3", value: 5710, series: "Realized Gains" },
    { label: "W4", value: 5935, series: "Realized Gains" },

    { label: "W1", value: 1540, series: "Realized Losses" },
    { label: "W2", value: 1480, series: "Realized Losses" },
    { label: "W3", value: 1625, series: "Realized Losses" },
    { label: "W4", value: 1540, series: "Realized Losses" },

    { label: "W1", value: 1145, series: "Total Passive Income" },
    { label: "W2", value: 1220, series: "Total Passive Income" },
    { label: "W3", value: 1290, series: "Total Passive Income" },
    { label: "W4", value: 1375, series: "Total Passive Income" },
  ],

  monthly: [
    { label: "Jan", value: 26420, series: "Total Portfolio Value" },
    { label: "Feb", value: 27100, series: "Total Portfolio Value" },
    { label: "Mar", value: 27980, series: "Total Portfolio Value" },
    { label: "Apr", value: 28640, series: "Total Portfolio Value" },
    { label: "May", value: 29420, series: "Total Portfolio Value" },
    { label: "Jun", value: 30180, series: "Total Portfolio Value" },

    { label: "Jan", value: 8240, series: "Realized Gains" },
    { label: "Feb", value: 8510, series: "Realized Gains" },
    { label: "Mar", value: 8940, series: "Realized Gains" },
    { label: "Apr", value: 9360, series: "Realized Gains" },
    { label: "May", value: 9780, series: "Realized Gains" },
    { label: "Jun", value: 10140, series: "Realized Gains" },

    { label: "Jan", value: 2160, series: "Realized Losses" },
    { label: "Feb", value: 2285, series: "Realized Losses" },
    { label: "Mar", value: 2410, series: "Realized Losses" },
    { label: "Apr", value: 2330, series: "Realized Losses" },
    { label: "May", value: 2480, series: "Realized Losses" },
    { label: "Jun", value: 2610, series: "Realized Losses" },

    { label: "Jan", value: 3420, series: "Total Passive Income" },
    { label: "Feb", value: 3560, series: "Total Passive Income" },
    { label: "Mar", value: 3715, series: "Total Passive Income" },
    { label: "Apr", value: 3890, series: "Total Passive Income" },
    { label: "May", value: 4020, series: "Total Passive Income" },
    { label: "Jun", value: 4210, series: "Total Passive Income" },
  ],

  quarterly: [
    { label: "Q1", value: 31880, series: "Total Portfolio Value" },
    { label: "Q2", value: 33720, series: "Total Portfolio Value" },
    { label: "Q3", value: 35460, series: "Total Portfolio Value" },
    { label: "Q4", value: 37240, series: "Total Portfolio Value" },

    { label: "Q1", value: 14920, series: "Realized Gains" },
    { label: "Q2", value: 16240, series: "Realized Gains" },
    { label: "Q3", value: 17480, series: "Realized Gains" },
    { label: "Q4", value: 18860, series: "Realized Gains" },

    { label: "Q1", value: 4210, series: "Realized Losses" },
    { label: "Q2", value: 4380, series: "Realized Losses" },
    { label: "Q3", value: 4620, series: "Realized Losses" },
    { label: "Q4", value: 4890, series: "Realized Losses" },

    { label: "Q1", value: 8760, series: "Total Passive Income" },
    { label: "Q2", value: 9240, series: "Total Passive Income" },
    { label: "Q3", value: 9780, series: "Total Passive Income" },
    { label: "Q4", value: 10420, series: "Total Passive Income" },
  ],

  yearly: [
    { label: "2021", value: 46300, series: "Total Portfolio Value" },
    { label: "2022", value: 51980, series: "Total Portfolio Value" },
    { label: "2023", value: 60420, series: "Total Portfolio Value" },
    { label: "2024", value: 71880, series: "Total Portfolio Value" },
    { label: "2025", value: 84640, series: "Total Portfolio Value" },

    { label: "2021", value: 28500, series: "Realized Gains" },
    { label: "2022", value: 32140, series: "Realized Gains" },
    { label: "2023", value: 36980, series: "Realized Gains" },
    { label: "2024", value: 42120, series: "Realized Gains" },
    { label: "2025", value: 48600, series: "Realized Gains" },

    { label: "2021", value: 9850, series: "Realized Losses" },
    { label: "2022", value: 11240, series: "Realized Losses" },
    { label: "2023", value: 12680, series: "Realized Losses" },
    { label: "2024", value: 13940, series: "Realized Losses" },
    { label: "2025", value: 15420, series: "Realized Losses" },

    { label: "2021", value: 18420, series: "Total Passive Income" },
    { label: "2022", value: 21460, series: "Total Passive Income" },
    { label: "2023", value: 24820, series: "Total Passive Income" },
    { label: "2024", value: 28640, series: "Total Passive Income" },
    { label: "2025", value: 33480, series: "Total Passive Income" },
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
  style: (datum: any) => {
    switch (datum.series) {
      case "Total Portfolio Value":
        return {
          stroke: "#C084FC", // brightest purple
          lineWidth: 3,
        };

      case "Realized Gains":
        return {
          stroke: "#7C3AED", // medium purple
          lineWidth: 2,
        };

      case "Total Passive Income":
        return {
          stroke: "#A855F7", // lighter purple
          lineWidth: 2,
          lineDash: [4, 4], // subtle differentiation
        };

      case "Realized Losses":
        return {
          stroke: "#F43F5E", // red/pink
          lineWidth: 2,
          lineDash: [2, 2],
        };

      default:
        return {};
    }
  },
},
    point: {
  visible: true,
  style: (datum: any) => ({
    fill: datum.series === "Realized Losses" ? "#F43F5E" : "#C084FC",
    stroke: "transparent",
    size: datum.series === "Total Portfolio Value" ? 6 : 4,
  }),
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