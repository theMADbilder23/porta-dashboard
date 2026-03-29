"use client";

import * as React from "react";
import { VChart } from "@visactor/react-vchart";
import type { ILinearProgressChartSpec } from "@visactor/vchart";
import type { Datum } from "@visactor/vchart/esm/typings";
import { formatPercent, formatUsdRounded, formatUsdPrecise } from "@/lib/utils";

const getSpec = (
  label: string,
  color: string,
  percentage: number,
  value: number,
  dailyYield: number,
  avgYield: number
): ILinearProgressChartSpec => {
  return {
    type: "linearProgress",
    data: [
      {
        id: "id0",
        values: [
          {
            type: label,
            value: percentage,
          },
        ],
      },
    ],
    direction: "horizontal",
    xField: "value",
    yField: "type",
    seriesField: "type",
    height: 10,
    cornerRadius: 10,
    progress: {
      style: {
        cornerRadius: 0,
      },
    },
    color: [color],
    bandwidth: 10,
    padding: 0,
    tooltip: {
      trigger: ["click", "hover"],
      mark: {
        title: {
          visible: false,
        },
        content: [
          {
            key: label,
            value: (_datum: Datum | undefined) =>
              `${formatUsdRounded(value)} • ${formatPercent(percentage, 2)} • ${formatUsdPrecise(
                dailyYield
              )}/day • ${formatPercent(avgYield, 2)} avg. APY`,
          },
        ],
      },
    },
    axes: [
      {
        orient: "right",
        type: "band",
        domainLine: { visible: false },
        tick: { visible: false },
        label: {
          formatMethod: () => formatPercent(percentage, 0),
        },
        maxWidth: "68%",
        width: 40,
      },
    ],
  };
};

export default function LinearProgress({
  label,
  color,
  value,
  avgYield,
  distributionPercentage,
  dailyYield,
  icon,
}: {
  label: string;
  color: string;
  value: number;
  avgYield: number;
  distributionPercentage: number;
  dailyYield: number;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-start gap-x-2">
        {icon}
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="flex items-baseline gap-x-2">
            <div className="text-xl font-medium">{formatUsdRounded(value)}</div>
            <div className="text-sm text-muted-foreground">
              {formatPercent(avgYield, 1)} avg. APY
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatUsdPrecise(dailyYield)}/day
          </div>
        </div>
      </div>
      <div className="relative">
        <VChart
          spec={getSpec(
            label,
            color,
            distributionPercentage,
            value,
            dailyYield,
            avgYield
          )}
        />
      </div>
    </div>
  );
}