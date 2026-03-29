"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { VChart } from "@visactor/react-vchart";
import type { ILinearProgressChartSpec } from "@visactor/vchart";
import type { Datum } from "@visactor/vchart/esm/typings";
import { formatPercent, formatUsdRounded, formatUsdPrecise } from "@/lib/utils";

function InfoTooltip({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground transition-colors group-hover:text-foreground" />
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-border bg-background/95 p-3 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        <div className="text-xs font-medium text-foreground">{title}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </div>
      </div>
    </div>
  );
}

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
        id: "i0",
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
              `${formatUsdRounded(value)} • ${formatPercent(
                percentage,
                2
              )} • ${formatUsdPrecise(dailyYield)}/day • ${formatPercent(
                avgYield,
                2
              )} avg. APY`,
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
  description,
  color,
  value,
  avgYield,
  distributionPercentage,
  dailyYield,
  icon,
}: {
  label: string;
  description: string;
  color: string;
  value: number;
  avgYield: number;
  distributionPercentage: number;
  dailyYield: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_300px] items-center gap-6">
      <div className="flex items-start gap-3">
        <div className="mt-1">{icon}</div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{label}</span>
            <InfoTooltip title={label} description={description} />
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-semibold leading-none">
              {formatUsdRounded(value)}
            </div>
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
          spec={getSpec(label, color, distributionPercentage, value, dailyYield, avgYield)}
        />
      </div>
    </div>
  );
}