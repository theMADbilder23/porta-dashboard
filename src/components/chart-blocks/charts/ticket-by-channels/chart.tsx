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
      summary: "Health score will improve once more tracked allocation data is available.",
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
    summary = "Stable Core and Rotational Core are supporting a healthier MMII structure.";
  } else if (growthPct >= 0.7) {
    summary =
      "Portfolio is heavily weighted toward Growth exposure with limited Stable Core and Rotational balance.";
  } else if (swingPct >= 0.15) {
    summary = "Swing exposure is elevated, which weakens overall portfolio health.";
  } else if (stablePct < 0.1 && rotationalPct < 0.1) {
    summary = "Defensive allocation is still underbuilt; health should improve as Core buckets grow.";
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
    "#E9D5FF",
    "#D8B4FE",
    "#C084FC",
    "#A855F7",
    "#9333EA",
    "#7E22CE",
    "#6D28D9",
    "#581C87",
  ];

  const inactiveColor = "#F3E8FF";

  return active ? activeColors[index] ?? "#581C87" : inactiveColor;
}

function AllocationPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">
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
  const activeSegments = Math.max(0, Math.round((health.score / 100) * segments));

  const meterSegments = Array.from({ length: segments }, (_, index) => {
    const startAngle = 180 - index * 22;
    const endAngle = startAngle - 16;
    const active = index < activeSegments;

    return {
      path: describeArc(160, 150, 92, startAngle, endAngle),
      color: getHealthColor(index, active),
      key: `segment-${index}`,
    };
  });

  const defensiveBase =
    safeNumber(overview?.stable_value) + safeNumber(overview?.rotational_value);

  return (
    <div className="flex h-full flex-col justify-between gap-5">
      <div className="rounded-2xl border border-border/60 bg-muted/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              MMII Health Meter
            </div>
            <div className="mt-1 flex items-center gap-2">
              {health.score >= 75 ? (
                <ShieldCheck className="h-4 w-4 text-[#6B21A8]" />
              ) : (
                <TriangleAlert className="h-4 w-4 text-[#A855F7]" />
              )}
              <span className="text-sm font-medium text-foreground">{health.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" />
            Transitional logic
          </div>
        </div>

        <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {health.summary}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(280px,340px)_minmax(120px,1fr)] items-center gap-4">
        <div className="flex flex-col gap-3">
          <AllocationPill label="Stable Core" value={health.stablePct} />
          <AllocationPill label="Growth" value={health.growthPct} />
        </div>

        <div className="flex justify-center">
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
                className="fill-foreground"
                style={{ fontSize: 16, fontWeight: 500 }}
              >
                Portfolio Health
              </text>

              <text
                x="160"
                y="170"
                textAnchor="middle"
                className="fill-foreground"
                style={{ fontSize: 22, fontWeight: 700 }}
              >
                {health.score}/100
              </text>
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <AllocationPill label="Rotational Core" value={health.rotationalPct} />
          <AllocationPill label="Swing" value={health.swingPct} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[340px] rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-center">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Current tracked defensive base
        </div>
        <div className="mt-1 text-sm font-medium text-foreground">
          {formatUsdRounded(defensiveBase)}
        </div>
      </div>
    </div>
  );
}