import type { OverviewResponse, YieldSummarySource } from "@/types/types";

export function buildYieldSourcesFromOverview(
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