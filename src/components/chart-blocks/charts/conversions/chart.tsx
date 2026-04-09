"use client";

import { VChart } from "@visactor/react-vchart";
import type { IPieChartSpec } from "@visactor/vchart";
import { formatUsdRounded } from "@/lib/utils";
import type { ConversionBucket } from "@/types/types";

type ConversionDatum = ConversionBucket & {
  percentage: number;
};

const ALLOCATION_COLORS: Record<string, string> = {
  Growth: "#7C3AED",
  Swing: "#8B5CF6",
  "Stable Core": "#A78BFA",
  "Rotational Core": "#C084FC",
};

export default function Chart({
  conversions,
}: {
  conversions: ConversionBucket[];
}) {
  const totalAllocation = conversions.reduce((sum, item) => sum + item.value, 0);

  const conversionData: ConversionDatum[] = conversions.map((item) => ({
    ...item,
    percentage: totalAllocation > 0 ? (item.value / totalAllocation) * 100 : 0,
  }));

  const spec: IPieChartSpec = {
    type: "pie",
    data: [
      {
        id: "allocationData",
        values: conversionData,
      },
    ],
    valueField: "value",
    categoryField: "name",
    outerRadius: 0.8,
    innerRadius: 0.62,
    padAngle: 1.5,
    cornerRadius: 5,
    pie: {
      style: {
        stroke: "transparent",
        lineWidth: 0,
      },
    },
    color: conversions.map(
      (item) => ALLOCATION_COLORS[item.name] || "#A78BFA"
    ),
    legends: [
      {
        visible: true,
        orient: "top",
        position: "middle",
        padding: 0,
        item: {
          shape: {
            style: {
              symbolType: "circle",
            },
          },
          label: {
            style: {
              fill: "#BFA9F5",
              fontSize: 12,
            },
          },
        },
      },
    ],
    label: {
      visible: false,
    },
    tooltip: {
      visible: true,
      trigger: ["hover", "click"],
      mark: {
        title: {
          value: (datum) => {
            const node = (datum ?? {}) as { name?: string };
            return node.name || "";
          },
        },
        content: [
          {
            key: (datum) => {
              const node = (datum ?? {}) as { name?: string };
              return node.name || "";
            },
            value: (datum) => {
              const node = (datum ?? {}) as {
                value?: number;
                percentage?: number;
              };

              return `${formatUsdRounded(node.value ?? 0)} · ${(
                node.percentage ?? 0
              ).toFixed(0)}%`;
            },
          },
        ],
      },
    },
    animationEnter: {
      easing: "cubicInOut",
      duration: 650,
    },
    animationUpdate: {
      easing: "cubicInOut",
      duration: 350,
    },
    animationExit: {
      easing: "cubicInOut",
      duration: 250,
    },
    background: "transparent",
  };

  return <VChart spec={spec} />;
}