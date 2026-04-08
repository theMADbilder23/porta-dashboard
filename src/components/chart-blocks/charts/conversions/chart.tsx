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
    outerRadius: 0.82,
    innerRadius: 0.58,
    padAngle: 1.5,
    cornerRadius: 6,
    pie: {
      style: {
        stroke: "transparent",
        lineWidth: 0,
      },
    },
    color: {
      field: "name",
      type: "ordinal",
      range: conversions.map(
        (item) => ALLOCATION_COLORS[item.name] || "#A78BFA"
      ),
    },
    legends: [
      {
        visible: true,
        orient: "top",
        position: "start",
        padding: 0,
        item: {
          shape: {
            style: {
              symbolType: "circle",
            },
          },
          label: {
            style: {
              fill: "#6B5A86",
              fontSize: 12,
            },
          },
        },
      },
    ],
    label: {
      visible: true,
      position: "inside",
      style: {
        fill: "#ffffff",
        fontWeight: "600",
        fontSize: 12,
        stroke: false,
      },
      text: (datum) => {
        const node = (datum ?? {}) as { percentage?: number };
        const pct = Number(node.percentage || 0);
        return pct >= 8 ? `${Math.round(pct)}%` : "";
      },
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

              return `${formatUsdRounded(node.value ?? 0)} • ${(
                node.percentage ?? 0
              ).toFixed(2)}%`;
            },
          },
        ],
      },
    },
    indicator: [
      {
        visible: true,
        trigger: "hover",
        title: {
          visible: true,
          autoFit: true,
          style: {
            fontSize: 12,
            fill: "#8B5CF6",
            fontWeight: "600",
          },
        },
        content: [
          {
            visible: true,
            style: {
              fontSize: 18,
              fill: "#2D1B45",
              fontWeight: "700",
            },
          },
        ],
      },
      {
        visible: true,
        trigger: "none",
        title: {
          visible: true,
          text: "MMII",
          style: {
            fontSize: 12,
            fill: "#8B5CF6",
            fontWeight: "600",
          },
        },
        content: [
          {
            visible: true,
            text: "100%",
            style: {
              fontSize: 20,
              fill: "#2D1B45",
              fontWeight: "700",
            },
          },
        ],
      },
    ],
    animationEnter: {
      easing: "cubicInOut",
      duration: 700,
    },
    animationUpdate: {
      easing: "cubicInOut",
      duration: 400,
    },
    animationExit: {
      easing: "cubicInOut",
      duration: 300,
    },
    background: "transparent",
  };

  return <VChart spec={spec} />;
}