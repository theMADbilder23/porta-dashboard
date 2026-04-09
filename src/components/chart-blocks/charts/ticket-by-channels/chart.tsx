"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, TriangleAlert, Info } from "lucide-react";
import { useOverview } from "@/hooks/use-overview";
import { useAtomValue } from "jotai";
import { overviewTimeframeAtom } from "@/lib/atoms/overview";
import { formatUsdRounded, formatPercent } from "@/lib/utils";

type HealthResult = {
  score: number;
  label: string;
  summary: string;
};

type StrategyFlowNode = {
  key?: string;
  label?: string;
  total_value_usd?: number;
  children?: StrategyFlowNode[];
};

type StrategyFlowResponse = {
  structure?: StrategyFlowNode;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildHealthResult(input: {
  stable: number;
  rotational: number;
  growth: number;
  swing: number;
}): HealthResult {
  const stable = safeNumber(input.stable);
  const rotational = safeNumber(input.rotational);
  const growth = safeNumber(input.growth);
  const swing = safeNumber(input.swing);

  const total = stable + rotational + growth + swing;

  if (total <= 0) {
    return {
      score: 0,
      label: "No Data",
      summary:
        "Health score will improve once more tracked allocation data is available.",
    };
  }

  const stablePct = stable / total;
  const rotationalPct = rotational / total;
  const growthPct = growth / total;
  const swingPct = swing / total;

  let score = 0;
  score += Math.min(stablePct / 0.4, 1) * 35;
  score += Math.min(rotationalPct / 0.3, 1) * 25;
  score += Math.max(0, 1 - Math.max(0, growthPct - 0.35) / 0.65) * 25;
  score += Math.max(0, 1 - Math.max(0, swingPct - 0.1) / 0.9) * 15;

  score = clamp(Math.round(score));

  let label = "Low Health";
  if (score >= 75) label = "Strong Health";
  else if (score >= 50) label = "Moderate Health";

  let summary = "Portfolio allocation is still early-stage and growth-heavy.";

  if (stablePct >= 0.3 && rotationalPct >= 0.15) {
    summary =
      "Stable Core and Rotational Core are supporting a healthier MMII structure.";
  } else if (growthPct >= 0.7) {
    summary =
      "Portfolio is heavily weighted toward Growth exposure with limited Stable Core and Rotational balance.";
  } else if (swingPct >= 0.15) {
    summary =
      "Swing exposure is elevated, which weakens overall portfolio health.";
  } else if (stablePct < 0.1 && rotationalPct < 0.1) {
    summary =
      "Defensive allocation is still underbuilt; health should improve as Core buckets grow.";
  }

  return {
    score,
    label,
    summary,
  };
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    1,
    end.x,
    end.y,
  ].join(" ");
}

function getScoreColor(score: number) {
  if (score >= 75) return "#7C3AED";
  if (score >= 50) return "#A855F7";
  return "#C084FC";
}

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

function findCoreLayerValue(
  node: StrategyFlowNode | undefined,
  targetKeys: string[]
): number {
  if (!node) return 0;

  let total = 0;

  if (node.key && targetKeys.includes(node.key)) {
    total += safeNumber(node.total_value_usd);
  }

  for (const child of node.children || []) {
    total += findCoreLayerValue(child, targetKeys);
  }

  return total;
}

function Gauge({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const clampedScore = clamp(score);
  const trackStart = 180;
  const trackEnd = 360;
  const filledEnd = trackStart + ((trackEnd - trackStart) * clampedScore) / 100;
  const accent = getScoreColor(clampedScore);

  const trackPath = describeArc(160, 148, 88, trackStart, trackEnd);
  const valuePath = describeArc(160, 148, 88, trackStart, filledEnd);

  return (
    <div className="mx-auto flex w-full max-w-[360px] justify-center rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-3 dark:border-[#241533] dark:bg-[#140D20]">
      <div className="relative h-[220px] w-full">
        <svg viewBox="0 0 320 220" className="h-full w-full overflow-visible">
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(168, 85, 247, 0.16)"
            strokeWidth="18"
            strokeLinecap="round"
          />

          <path
            d={valuePath}
            fill="none"
            stroke={accent}
            strokeWidth="18"
            strokeLinecap="round"
          />

          <text
            x="56"
            y="186"
            textAnchor="middle"
            fill="currentColor"
            className="text-[#6B5A86] dark:text-[#BFA9F5]"
            style={{ fontSize: 11, fontWeight: 500 }}
          >
            Low
          </text>

          <text
            x="160"
            y="40"
            textAnchor="middle"
            fill="currentColor"
            className="text-[#6B5A86] dark:text-[#BFA9F5]"
            style={{ fontSize: 11, fontWeight: 500 }}
          >
            Moderate
          </text>

          <text
            x="264"
            y="186"
            textAnchor="middle"
            fill="currentColor"
            className="text-[#6B5A86] dark:text-[#BFA9F5]"
            style={{ fontSize: 11, fontWeight: 500 }}
          >
            Strong
          </text>

          <text
            x="160"
            y="122"
            textAnchor="middle"
            fill="currentColor"
            className="text-[#2D1B45] dark:text-[#F3E8FF]"
            style={{ fontSize: 15, fontWeight: 500 }}
          >
            Portfolio Health
          </text>

          <text
            x="160"
            y="148"
            textAnchor="middle"
            fill="currentColor"
            className="text-[#2D1B45] dark:text-[#F3E8FF]"
            style={{ fontSize: 26, fontWeight: 700 }}
          >
            {clampedScore}/100
          </text>

          <text
            x="160"
            y="171"
            textAnchor="middle"
            fill="currentColor"
            className="text-[#6B5A86] dark:text-[#BFA9F5]"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            {label}
          </text>
        </svg>
      </div>
    </div>
  );
}

export default function Chart() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const { data: overview } = useOverview(timeframe);

  const [defensiveBaseValue, setDefensiveBaseValue] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStrategyFlow() {
      try {
        const res = await fetch("/api/strategy-flow", {
          cache: "no-store",
        });

        const data: StrategyFlowResponse = await res.json();

        if (cancelled) return;

        const total = findCoreLayerValue(data?.structure, [
          "stable_core",
          "rotational_core",
          "rotational_anchors",
        ]);

        setDefensiveBaseValue(total);
      } catch {
        if (!cancelled) {
          setDefensiveBaseValue(0);
        }
      }
    }

    loadStrategyFlow();

    return () => {
      cancelled = true;
    };
  }, []);

  const health = useMemo(
    () =>
      buildHealthResult({
        stable: overview?.stable_value ?? 0,
        rotational: overview?.rotational_value ?? 0,
        growth: overview?.growth_value ?? 0,
        swing: overview?.swing_value ?? 0,
      }),
    [overview]
  );

  const totalPortfolioValue = safeNumber(overview?.total_portfolio_value);
  const defensiveBasePct =
    totalPortfolioValue > 0 ? defensiveBaseValue / totalPortfolioValue : 0;

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-[#E9DAFF] bg-white p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241533] dark:bg-[#140D20]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
              MMII Health Meter
            </div>

            <div className="mt-2 flex items-center gap-2">
              {health.score >= 75 ? (
                <ShieldCheck className="h-4 w-4 text-[#6B21A8]" />
              ) : (
                <TriangleAlert className="h-4 w-4 text-[#A855F7]" />
              )}
              <span className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                {health.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-[#E9DAFF] bg-white px-2.5 py-1 text-[11px] text-[#6B5A86] dark:border-[#2A1D3B] dark:bg-[#100A19] dark:text-[#BFA9F5]">
            <Info className="h-3 w-3" />
            Transitional logic
          </div>
        </div>

        <div className="mt-3 text-sm leading-relaxed text-[#6B5A86] dark:text-[#BFA9F5]">
          {health.summary}
        </div>
      </div>

      <Gauge score={health.score} label={health.label} />

      <div className="mx-auto w-full max-w-[360px] rounded-2xl border border-[#E9DAFF] bg-white px-4 py-4 text-center shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
          <span>Current tracked defensive base</span>
          <InfoTooltip
            title="Current Tracked Defensive Base"
            description="Combined tracked Stable Core, Rotational Core, and Rotational Anchors value sourced from the MMII Structural Tree."
          />
        </div>

        <div className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
          {formatUsdRounded(defensiveBaseValue)}
        </div>

        <div className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
          {formatPercent(defensiveBasePct * 100, 1)} of total portfolio
        </div>
      </div>
    </div>
  );
}