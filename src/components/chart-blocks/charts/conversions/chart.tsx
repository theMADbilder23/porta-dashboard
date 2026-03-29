"use client";

import { VChart } from "@visactor/react-vchart";
import type { ICirclePackingChartSpec } from "@visactor/vchart";
import { addThousandsSeparator } from "@/lib/utils";
import type { ConversionBucket } from "@/types/types";

export default function Chart({
  conversions,
}: {
  conversions: ConversionBucket[];
}) {
  const totalAllocation = conversions.reduce((sum, item) => sum + item.value, 0);

  const conversionData = conversions.map((item) => ({
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
          const node = d as {
            name?: string;
            value?: number;
            percentage?: number;
          };

          return `${node.name}\n$${addThousandsSeparator(node.value ?? 0)}\n${Math.round(
            node.percentage ?? 0
          )}%`;
        },
        fontSize: (d) => Math.max(10, d.radius / 4.25),
        lineHeight: 14,
        limit: 120,
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
            key: (d) => d?.name ?? "",
            value: (d: { value?: number; percentage?: number }) =>
              `$${addThousandsSeparator(d?.value ?? 0)} • ${(
                d?.percentage ?? 0
              ).toFixed(2)}%`,
          },
        ],
      },
    },
    animationEnter: {
      easing: "cubicInOut",
    },
    animationExit: {
      easing: "cubicInOut",
    },
    animationUpdate: {
      easing: "cubicInOut",
    },
  };

  return <VChart spec={spec} />;
}