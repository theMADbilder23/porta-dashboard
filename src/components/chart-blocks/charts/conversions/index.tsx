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
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="MMII Allocation" icon={Layers3} />

      <div className="relative h-[320px] w-full pt-2">
        <Chart conversions={conversions} />
      </div>

      <AlignmentMeter conversions={conversions} />
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
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>MMII Alignment Meter</span>
        <span>{score}/100</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-400 transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="text-right">{insight}</span>
      </div>
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