"use client";

import { VChart } from "@visactor/react-vchart";
import type { ILinearProgressChartSpec } from "@visactor/vchart";
import type { Datum } from "@visactor/vchart/esm/typings";
import { addThousandsSeparator, numberToPercentage } from "@/lib/utils";

const getSpec = (
  label: string,
  color: string,
  percentage: number,
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
    bandWidth: 10,
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
            value: (datum: Datum | undefined) =>
              datum ? `${numberToPercentage(percentage)}` : "",
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
          formatMethod: () => numberToPercentage(percentage),
        },
        maxWidth: "60%",
        width: 36,
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
  icon,
}: {
  label: string;
  color: string;
  value: number;
  avgYield: number;
  distributionPercentage: number;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-start gap-x-2">
        {icon}
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="flex items-baseline gap-x-2">
            <div className="text-xl font-medium">
              ${addThousandsSeparator(value)}
            </div>
            <div className="text-sm text-muted-foreground">
              {avgYield}% avg. APY
            </div>
          </div>
        </div>
      </div>
      <div className="relative">
        <VChart spec={getSpec(label, color, distributionPercentage)} />
      </div>
    </div>
  );
}