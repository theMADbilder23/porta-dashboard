"use client";

import { Layers3 } from "lucide-react";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";
import { buildConversionsFromOverview } from "@/data/conversions";
import { useOverview } from "@/hooks/use-overview";
import type { ConversionBucket } from "@/types/types";

export default function Conversions() {
  const { data: overview } = useOverview();
  const conversions = buildConversionsFromOverview(overview);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <ChartTitle title="MMII Allocation" icon={Layers3} />

      <div className="mt-4 flex flex-1 flex-col gap-4">
        <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241533] dark:bg-[#140D20]">
          <div className="h-[260px] w-full">
            <Chart conversions={conversions} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SleeveCard
            label="Stable Core"
            value={getValueByName(conversions, "Stable Core")}
            accentClass="text-[#A78BFA] dark:text-[#C4B5FD]"
          />
          <SleeveCard
            label="Rotational Core"
            value={getValueByName(conversions, "Rotational Core")}
            accentClass="text-[#C084FC] dark:text-[#D8B4FE]"
          />
          <SleeveCard
            label="Growth"
            value={getValueByName(conversions, "Growth")}
            accentClass="text-[#7C3AED] dark:text-[#A78BFA]"
          />
          <SleeveCard
            label="Swing"
            value={getValueByName(conversions, "Swing")}
            accentClass="text-[#8B5CF6] dark:text-[#C4B5FD]"
          />
        </div>

        <AlignmentMeter conversions={conversions} />
      </div>
    </section>
  );
}

function AlignmentMeter({
  conversions,
}: {
  conversions: ConversionBucket[];
}) {
  const stable = getValueByName(conversions, "Stable Core");
  const rotational = getValueByName(conversions, "Rotational Core");
  const growth = getValueByName(conversions, "Growth");
  const swing = getValueByName(conversions, "Swing");

  let score = 0;

  if (stable > rotational) score += 25;
  if (rotational > growth) score += 25;
  if (growth > swing) score += 25;
  if (swing === Math.min(stable, rotational, growth, swing)) score += 25;

  const label =
    score >= 75
      ? "Strong Alignment"
      : score >= 50
      ? "Moderate Alignment"
      : "Low Alignment";

  const insight = buildAlignmentInsight({
    stable,
    rotational,
    growth,
    swing,
  });

  return (
    <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241533] dark:bg-[#140D20]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B5A86] dark:text-[#BFA9F5]">
            MMII Alignment Meter
          </p>
          <p className="mt-1 text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {label}
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {score}/100
          </p>
        </div>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#EFE7FF] dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-400 transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3 text-xs">
        <span className="font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
          {label}
        </span>
        <span className="max-w-[68%] text-right text-[#6B5A86] dark:text-[#BFA9F5]">
          {insight}
        </span>
      </div>
    </div>
  );
}

function SleeveCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: number;
  accentClass: string;
}) {
  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white px-3 py-3 dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <p className={`text-[11px] font-medium uppercase tracking-[0.14em] ${accentClass}`}>
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold leading-none text-[#2D1B45] dark:text-[#F3E8FF]">
        {Math.round(value)}%
      </p>
    </div>
  );
}

function getValueByName(
  conversions: ConversionBucket[],
  name: ConversionBucket["name"]
) {
  const item = conversions.find((entry) => entry.name === name);
  return Number(item?.value) || 0;
}

function buildAlignmentInsight(values: {
  stable: number;
  rotational: number;
  growth: number;
  swing: number;
}) {
  const entries = [
    { name: "Stable Core", value: values.stable },
    { name: "Rotational Core", value: values.rotational },
    { name: "Growth", value: values.growth },
    { name: "Swing", value: values.swing },
  ].sort((a, b) => b.value - a.value);

  const dominant = entries[0];
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const dominantPct = total > 0 ? Math.round((dominant.value / total) * 100) : 0;

  if (dominant.name === "Growth") {
    return `Portfolio heavily allocated toward growth exposure (${dominantPct}%)`;
  }

  if (dominant.name === "Stable Core") {
    return `Portfolio currently prioritizing capital preservation (${dominantPct}%)`;
  }

  if (dominant.name === "Rotational Core") {
    return `Portfolio tilted toward rotational core positioning (${dominantPct}%)`;
  }

  return `Portfolio carrying elevated swing exposure (${dominantPct}%)`;
}