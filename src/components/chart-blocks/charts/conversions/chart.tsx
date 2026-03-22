"use client";

import { VChart } from "@visactor/react-vchart";
import type { ICirclePackingChartSpec } from "@visactor/vchart";
import conversions from "@/data/conversions";
import { addThousandsSeparator } from "@/lib/utils";

const spec: ICirclePackingChartSpec = {
  data: [
    {
      id: "data",
      values: conversions,
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
      text: (d) => `${Math.round((d.value / conversions.reduce((acc, curr) => acc + curr.value, 0)) * 100)}%`,
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
        value: (d) => addThousandsSeparator(d?.value),
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
