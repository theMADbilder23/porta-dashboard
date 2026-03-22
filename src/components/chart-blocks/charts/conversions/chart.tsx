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

  interaction: {
    hover: {
      enable: true,
    },
  },
  
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
      text: (d) => `${d?.percentage}%`,
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
  state: {
    hover: {
      scale: 1.08,
      stroke: "#ffffff",
      lineWidth: 2,
      shadowBlur: 20,
      shadowColor: "rgba(168, 85, 247, 0.6)",
  },
    selected: {
      scale: 1.1,
  },
},
};

export default function Chart() {
  return <VChart spec={spec} />;
}
