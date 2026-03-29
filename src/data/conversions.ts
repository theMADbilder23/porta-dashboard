import type { ConversionBucket, OverviewResponse } from "@/types/types";

export function buildConversionsFromOverview(
  overview?: Partial<OverviewResponse> | null
): ConversionBucket[] {
  return [
    {
      name: "Stable Core",
      value: safeNumber(overview?.stable_value),
      color: "#7C3AED",
    },
    {
      name: "Rotational Core",
      value: safeNumber(overview?.rotational_value),
      color: "#8B5CF6",
    },
    {
      name: "Growth",
      value: safeNumber(overview?.growth_value),
      color: "#A78BFA",
    },
    {
      name: "Swing",
      value: safeNumber(overview?.swing_value),
      color: "#E879F9",
    },
  ];
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}