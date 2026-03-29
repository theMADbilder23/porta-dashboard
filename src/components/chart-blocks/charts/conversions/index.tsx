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

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span>Stable &gt; Rotational &gt; Growth &gt; Swing</span>
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