"use client";

import { Coins, Landmark, TrendingUp, Zap } from "lucide-react";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";
import { useOverview } from "@/hooks/use-overview";
import { formatUsdRounded, formatPercent } from "@/lib/utils";
import type { OverviewResponse } from "@/types/types";

type YieldSummarySourceLabel =
  | "Stable Yield"
  | "Hard Asset Yield"
  | "Growth / Risk Yield";

type YieldSummarySourceWithMeta = {
  label: YieldSummarySourceLabel;
  description: string;
  color: string;
  value: number;
  avgYield: number;
  distributionPercentage: number;
  dailyYield: number;
};

const icons = {
  "Stable Yield": <Landmark className="h-5 w-5 stroke-[#A855F7]" />,
  "Hard Asset Yield": <TrendingUp className="h-5 w-5 stroke-[#7C3AED]" />,
  "Growth / Risk Yield": <Zap className="h-5 w-5 stroke-[#C084FC]" />,
} as const;

export default function CustomerSatisfaction() {
  const { data: overview } = useOverview();
  const yieldSources = buildYieldSourcesFromOverview(overview);

  const totalDistributed = yieldSources.reduce((sum, item) => sum + item.value, 0);

  const totalAvgApy =
    totalDistributed > 0
      ? (yieldSources.reduce(
          (sum, item) => sum + item.value * (item.avgYield / 100),
          0
        ) /
          totalDistributed) *
        100
      : 0;

  return (
    <section className="flex h-full flex-col gap-3">
      <ChartTitle title="Yield Summary" icon={Coins} />

      <div className="mt-4 flex h-full flex-col items-center gap-8">
        <div className="flex w-full justify-center pt-3">
          <TotalDistributed value={totalDistributed} totalAvgApy={totalAvgApy} />
        </div>

        <div className="mx-auto flex w-full max-w-[700px] flex-col gap-5 pt-3">
          {yieldSources.map((source) => (
            <LinearProgress
              key={source.label}
              label={source.label}
              description={source.description}
              color={source.color}
              value={source.value}
              avgYield={source.avgYield}
              distributionPercentage={source.distributionPercentage}
              dailyYield={source.dailyYield}
              icon={icons[source.label]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TotalDistributed({
  value,
  totalAvgApy,
}: {
  value: number;
  totalAvgApy: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Total Value Distributed
      </div>
      <div className="mt-2 text-[1.38rem] font-semibold leading-none text-foreground md:text-[1.55rem]">
        {formatUsdRounded(value)}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        {formatPercent(totalAvgApy, 1)} total avg. APY
      </div>
    </div>
  );
}

function buildYieldSourcesFromOverview(
  overview?: Partial<OverviewResponse> | null
): YieldSummarySourceWithMeta[] {
  const stableValue = safeNumber(overview?.stable_yield_value);
  const hardAssetValue = safeNumber(overview?.hard_asset_yield_value);
  const growthRiskValue = safeNumber(overview?.growth_risk_yield_value);

  const totalDistributed =
    safeNumber(overview?.total_value_distributed) ||
    stableValue + hardAssetValue + growthRiskValue;

  return [
    {
      label: "Stable Yield",
      description:
        "Stable Core yield positions. This tracks lower-risk yield-bearing capital inside the defensive sleeve.",
      color: "#A855F7",
      value: stableValue,
      avgYield: safeNumber(overview?.stable_avg_apy),
      dailyYield: safeNumber(overview?.stable_daily_yield),
      distributionPercentage:
        totalDistributed > 0 ? (stableValue / totalDistributed) * 100 : 0,
    },
    {
      label: "Hard Asset Yield",
      description:
        "Yield generated from hard asset and commodity income positions once those tracked sources are connected.",
      color: "#7C3AED",
      value: hardAssetValue,
      avgYield: safeNumber(overview?.hard_asset_avg_apy),
      dailyYield: safeNumber(overview?.hard_asset_daily_yield),
      distributionPercentage:
        totalDistributed > 0 ? (hardAssetValue / totalDistributed) * 100 : 0,
    },
    {
      label: "Growth / Risk Yield",
      description:
        "Yield produced by higher-risk growth allocations, currently sourced from Yield + Hub role wallet protocol positions.",
      color: "#C084FC",
      value: growthRiskValue,
      avgYield: safeNumber(overview?.growth_risk_avg_apy),
      dailyYield: safeNumber(overview?.growth_risk_daily_yield),
      distributionPercentage:
        totalDistributed > 0 ? (growthRiskValue / totalDistributed) * 100 : 0,
    },
  ];
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}