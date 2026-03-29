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
        cornerRadius: 10,
      },
    },
    color: [color],
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
    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
      <div className="flex items-start gap-2">
        <div className="mt-1">{icon}</div>

        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>

          <div className="mt-0.5 flex items-baseline gap-2">
            <div className="text-3xl font-semibold leading-none">{formatUsdRounded(value)}</div>
            <div className="text-sm text-muted-foreground">
              {formatPercent(avgYield, 1)} avg. APY
            </div>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {formatUsdPrecise(dailyYield)}/day
          </div>
        </div>
      </div>

      <div className="w-[300px] max-w-full">
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