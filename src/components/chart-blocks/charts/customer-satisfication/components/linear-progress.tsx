"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { VChart } from "@visactor/react-vchart";
import type { ILinearProgressChartSpec } from "@visactor/vchart";
import type { Datum } from "@visactor/vchart/esm/typing";
import {
  formatPercent,
  formatUsdRounded,
  formatUsdPrecise,
} from "@/lib/utils";

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
    cornerRadius: 999,
    progress: {
      style: {
        cornerRadius: 999,
      },
    },
    track: {
      style: {
        cornerRadius: 999,
        fill: "rgba(139, 92, 246, 0.10)",
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
          style: {
            fill: "#6B5A86",
            fontSize: 11,
            fontWeight: 500,
          },
        },
        maxWidth: "68%",
        width: 40,
      },
    ],
    background: "transparent",
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
    <div className="w-full rounded-2xl border border-[#E9DAFF] bg-white px-4 py-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="mt-0.5 shrink-0 text-[#8B5CF6]">{icon}</div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-sm font-semibold text-foreground">
                {label}
              </div>
              <InfoTooltip title={label} description={description} />
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {description}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold leading-none text-foreground">
            {formatUsdRounded(value)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPercent(avgYield, 1)} avg. APY ({formatUsdPrecise(dailyYield)}
            /day)
          </div>
        </div>
      </div>

      <div className="mt-4 w-full">
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