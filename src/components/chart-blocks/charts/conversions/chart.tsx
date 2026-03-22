"use client";

import { VChart } from "@visactor/react-vchart";
import type { ICirclePackingChartSpec } from "@visactor/vchart";
import conversions from "@/data/conversions";
import { addThousandsSeparator } from "@/lib/utils";

const totalAllocation = conversions.reduce((sum, item) => sum + item.value, 0);

const conversionData = conversions.map((item) => ({
  ...item,
  percentage: Math.round((item.value / totalAllocation) * 100),
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
        const node = d as { percentage?: number; name?: string; value?: number; isHover?: boolean };
        return node?.isHover
          ? `${node.name}\n$${addThousandsSeparator(node.value ?? 0)}`
          : `${node.percentage ?? 0}%`;
      },
      fontSize: (d) => d.radius / 2,
      dy: (d) => d.radius / 8,
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
      content: {
        value: (d) => `${d?.name}: $${addThousandsSeparator(d?.value)}`,
      },
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

export default function Chart() {
  return <VChart spec={spec} />;
}
