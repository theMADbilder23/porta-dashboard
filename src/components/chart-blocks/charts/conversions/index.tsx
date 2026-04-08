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

      <div className="mt-3 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241533] dark:bg-[#140D20]">
          <div className="h-[320px] w-full">
            <Chart conversions={conversions} />
          </div>
        </div>

        <AlignmentMeter conversions={conversions} />
      </div>
    </section>
  );
}

function AlignmentMeter({ conversions }: { conversions: ConversionBucket[] }) {
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
    <div className="flex flex-col justify-between rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241533] dark:bg-[#140D20]">
      <div>
        <div className="flex items-center justify-between text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
          <span>MMII Alignment Meter</span>
          <span>{score}/100</span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#EFE7FF] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-400 transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
            {label}
          </span>
          <span className="text-right text-[#6B5A86] dark:text-[#BFA9F5]">
            {insight}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniBucketCard label="Stable Core" value={stable} />
        <MiniBucketCard label="Rotational Core" value={rotational} />
        <MiniBucketCard label="Growth" value={growth} />
        <MiniBucketCard label="Swing" value={swing} />
      </div>
    </div>
  );
}

function MiniBucketCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white px-3 py-3 dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
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