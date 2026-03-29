"use client";

import { VChart } from "@visactor/react-vchart";
import type { ICirclePackingChartSpec } from "@visactor/vchart";
import { formatUsdRounded } from "@/lib/utils";
import type { ConversionBucket } from "@/types/types";

type ConversionDatum = ConversionBucket & {
  percentage: number;
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

  const spec: ICirclePackingChartSpec = {
    data: [
      {
        id: "data",
        values: conversionData,
      },
    ],
    type: "circlePacking",
    categoryField: "name",
    valueField: "value",
    drill: true,
    padding: 0,
    layoutPadding: 5,
    label: {
      style: {
        fill: "white",
        stroke: false,
        visible: (d) => d.depth === 0,
        text: (d) => {
          const node = d as { percentage?: number };
          return `${Math.round(node.percentage ?? 0)}%`;
        },
        fontSize: (d) => Math.max(12, d.radius / 3.8),
        lineHeight: 14,
        limit: 80,
        dy: 0,
      },
    },
    legends: [
      {
        visible: true,
        orient: "top",
        position: "start",
        padding: 0,
      },
    ],
    tooltip: {
      trigger: ["click", "hover"],
      mark: {
        content: [
          {
            key: (d) => {
              const datum = (d ?? {}) as { name?: string };
              return datum.name ?? "";
            },
            value: (d) => {
              const datum = (d ?? {}) as {
                value?: number;
                percentage?: number;
              };

              return `${formatUsdRounded(datum.value ?? 0)} • ${(
                datum.percentage ?? 0
              ).toFixed(2)}%`;
            },
          },
        ],
      },
    },
    animationEnter: {
      easing: "cubicInOut",
      duration: 800,
    },
    animationExit: {
      easing: "cubicInOut",
      duration: 400,
    },
    animationUpdate: {
      easing: "cubicInOut",
      duration: 500,
    },
  };

  return <VChart spec={spec} />;
}