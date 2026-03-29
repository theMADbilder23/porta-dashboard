"use client";

import { Coins, Landmark, TrendingUp, Zap } from "lucide-react";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";
import { useOverview } from "@/hooks/use-overview";
import { formatUsdRounded } from "@/lib/utils";
import type { OverviewResponse, YieldSummarySource } from "@/types/types";

const icons = {
  "Stable Yield": <Landmark className="h-5 w-5 stroke-[#A855F7]" />,
  "Hard Asset Yield": <TrendingUp className="h-5 w-5 stroke-[#7C3AED]" />,
  "Growth / Risk Yield": <Zap className="h-5 w-5 stroke-[#C084FC]" />,
} as const;

export default function CustomerSatisfaction() {
  const { data: overview } = useOverview();
  const yieldSources = buildYieldSourcesFromOverview(overview);

  const totalDistributed = yieldSources.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Yield Summary" icon={Coins} />

      <div className="my-4 flex h-full items-center justify-between">
        <div className="mx-auto grid w-full grid-cols-2 gap-6">
          <TotalDistributed value={totalDistributed} />

          {yieldSources.map((source) => (
            <LinearProgress
              key={source.label}
              label={source.label}
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

function TotalDistributed({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-start justify-center">
      <div className="text-xs text-muted-foreground">Total Value Distributed</div>
      <div className="text-2xl font-medium">{formatUsdRounded(value)}</div>
    </div>
  );
}

function buildYieldSourcesFromOverview(
  overview?: Partial<OverviewResponse> | null
): YieldSummarySource[] {
  const stableValue = safeNumber(overview?.stable_yield_value);
  const hardAssetValue = safeNumber(overview?.hard_asset_yield_value);
  const growthRiskValue = safeNumber(overview?.growth_risk_yield_value);

  const totalDistributed =
    safeNumber(overview?.total_value_distributed) ||
    stableValue + hardAssetValue + growthRiskValue;

  return [
    {
      label: "Stable Yield",
      color: "#A855F7",
      value: stableValue,
      avgYield: safeNumber(overview?.stable_avg_apy),
      dailyYield: safeNumber(overview?.stable_daily_yield),
      distributionPercentage:
        totalDistributed > 0 ? (stableValue / totalDistributed) * 100 : 0,
    },
    {
      label: "Hard Asset Yield",
      color: "#7C3AED",
      value: hardAssetValue,
      avgYield: safeNumber(overview?.hard_asset_avg_apy),
      dailyYield: safeNumber(overview?.hard_asset_daily_yield),
      distributionPercentage:
        totalDistributed > 0 ? (hardAssetValue / totalDistributed) * 100 : 0,
    },
    {
      label: "Growth / Risk Yield",
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