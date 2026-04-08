"use client";

import { useMemo } from "react";
import { ShieldCheck, TriangleAlert, Info } from "lucide-react";
import { useOverview } from "@/hooks/use-overview";
import { useAtomValue } from "jotai";
import { overviewTimeframeAtom } from "@/lib/atoms/overview";
import { formatUsdRounded, formatPercent } from "@/lib/utils";

type HealthResult = {
  score: number;
  label: string;
  summary: string;
  stablePct: number;
  rotationalPct: number;
  growthPct: number;
  swingPct: number;
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
      stablePct: 0,
      rotationalPct: 0,
      growthPct: 0,
      swingPct: 0,
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
    stablePct,
    rotationalPct,
    growthPct,
    swingPct,
  };
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0;
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
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function getHealthColor(index: number, active: boolean) {
  const activeColors = [
    "#F3E8FF",
    "#E9D5FF",
    "#D8B4FE",
    "#C084FC",
    "#A855F7",
    "#9333EA",
    "#7E22CE",
    "#6D28D9",
  ];

  const inactiveColor = "#F5F0FF";

  return active ? activeColors[index] ?? "#6D28D9" : inactiveColor;
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

function AllocationPill({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E9DAFF] bg-white px-4 py-3 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        <span>{label}</span>
        <InfoTooltip title={label} description={description} />
      </div>

      <div className="mt-2 text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {formatPercent(value * 100, 1)}
      </div>
    </div>
  );
}

export default function Chart() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const { data: overview } = useOverview(timeframe);

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

  const segments = 8;
  const activeSegments = Math.max(
    0,
    Math.round((health.score / 100) * segments)
  );

  const meterSegments = Array.from({ length: segments }, (_, index) => {
    const startAngle = 180 - index * 22;
    const endAngle = startAngle - 16;
    const active = index < activeSegments;

    return {
      path: describeArc(160, 150, 96, startAngle, endAngle),
      color: getHealthColor(index, active),
      key: `segment-${index}`,
    };
  });

  const defensiveBase =
    safeNumber(overview?.stable_value) + safeNumber(overview?.rotational_value);

  return (
    <div className="flex h-full flex-col gap-5 rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-5 dark:border-[#241533] dark:bg-[#140D20]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[120px_minmax(280px,360px)_120px] xl:items-center xl:justify-center">
        <div className="flex flex-col gap-3">
          <AllocationPill
            label="Stable Core"
            value={health.stablePct}
            description="Defensive stable-yield allocation. Higher Stable Core generally improves overall portfolio health."
          />
          <AllocationPill
            label="Growth"
            value={health.growthPct}
            description="Higher-upside growth allocation used to build liquidity during expansion phases."
          />
        </div>

        <div className="flex justify-center rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241533] dark:bg-[#140D20]">
          <div className="relative h-[220px] w-full max-w-[340px]">
            <svg viewBox="0 0 320 220" className="h-full w-full overflow-visible">
              {meterSegments.map((segment) => (
                <path
                  key={segment.key}
                  d={segment.path}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
              ))}

              <text
                x="160"
                y="145"
                textAnchor="middle"
                fill="currentColor"
                className="text-[#2D1B45] dark:text-[#F3E8FF]"
                style={{ fontSize: 16, fontWeight: 500 }}
              >
                Portfolio Health
              </text>

              <text
                x="160"
                y="170"
                textAnchor="middle"
                fill="currentColor"
                className="text-[#2D1B45] dark:text-[#F3E8FF]"
                style={{ fontSize: 22, fontWeight: 700 }}
              >
                {health.score}/100
              </text>
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <AllocationPill
            label="Rotational Core"
            value={health.rotationalPct}
            description="Secondary core bucket used to rebalance between defensive capital and higher-growth allocations."
          />
          <AllocationPill
            label="Swing"
            value={health.swingPct}
            description="Highest-risk tactical sleeve. Larger swing exposure tends to weaken portfolio health."
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[360px] rounded-2xl border border-[#E9DAFF] bg-white px-4 py-4 text-center shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
          <span>Current tracked defensive base</span>
          <InfoTooltip
            title="Current Tracked Defensive Base"
            description="Combined tracked Stable Core + Rotational Core value. This is the currently visible defensive base inside the dashboard."
          />
        </div>

        <div className="mt-2 text-base font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
          {formatUsdRounded(defensiveBase)}
        </div>
      </div>
    </div>
  );
}