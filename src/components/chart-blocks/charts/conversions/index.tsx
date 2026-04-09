"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3, Info } from "lucide-react";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";
import { buildConversionsFromOverview } from "@/data/conversions";
import { useOverview } from "@/hooks/use-overview";
import type { ConversionBucket } from "@/types/types";

type StrategyFlowNode = {
  key?: string;
  label?: string;
  total_value_usd?: number;
  allocation_pct?: number;
  children?: StrategyFlowNode[];
};

type StrategyFlowResponse = {
  structure?: StrategyFlowNode;
};

type Slice = {
  name: string;
  value: number;
};

export default function Conversions() {
  const { data: overview } = useOverview();
  const bucketConversions = buildConversionsFromOverview(overview);

  const [strategyFlow, setStrategyFlow] = useState<StrategyFlowResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStrategyFlow() {
      try {
        const res = await fetch("/api/strategy-flow", {
          cache: "no-store",
        });

        const data: StrategyFlowResponse = await res.json();

        if (!cancelled) {
          setStrategyFlow(data);
        }
      } catch {
        if (!cancelled) {
          setStrategyFlow(null);
        }
      }
    }

    loadStrategyFlow();

    return () => {
      cancelled = true;
    };
  }, []);

  const tierConversions = useMemo<Slice[]>(() => {
    const tiers = strategyFlow?.structure?.children ?? [];

    const tier0 = getNodeValueByKey(tiers, "tier_0");
    const tier1 = getNodeValueByKey(tiers, "tier_1");
    const tier2 = getNodeValueByKey(tiers, "tier_2");

    return [
      { name: "Tier 0", value: tier0 },
      { name: "Tier 1", value: tier1 },
      { name: "Tier 2", value: tier2 },
    ];
  }, [strategyFlow]);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <ChartTitle title="MMII Allocation" icon={Layers3} />

      <div className="mt-4 flex flex-1 flex-col gap-4">
        <AllocationSection
          title="MMII Tiers"
          description="Top-level structural distribution across Foundational Hub, Collateralized Liquidity, and Direct Allocation."
          conversions={tierConversions}
          cards={[
            {
              label: "Tier 0 — Foundational Hub",
              value: getPercentByName(tierConversions, "Tier 0"),
              accentClass: "text-[#A78BFA] dark:text-[#C4B5FD]",
            },
            {
              label: "Tier 1 — Collateralized Liquidity",
              value: getPercentByName(tierConversions, "Tier 1"),
              accentClass: "text-[#C084FC] dark:text-[#D8B4FE]",
            },
            {
              label: "Tier 2 — Direct Allocation",
              value: getPercentByName(tierConversions, "Tier 2"),
              accentClass: "text-[#7C3AED] dark:text-[#A78BFA]",
            },
          ]}
          gridClassName="grid-cols-1 md:grid-cols-3"
        />

        <AllocationSection
          title="MMII Buckets"
          description="Core bucket distribution across Stable Core, Rotational Core, Growth, and Swing."
          conversions={bucketConversions}
          cards={[
            {
              label: "Stable Core",
              value: getPercentByName(bucketConversions, "Stable Core"),
              accentClass: "text-[#A78BFA] dark:text-[#C4B5FD]",
            },
            {
              label: "Rotational Core",
              value: getPercentByName(bucketConversions, "Rotational Core"),
              accentClass: "text-[#C084FC] dark:text-[#D8B4FE]",
            },
            {
              label: "Growth",
              value: getPercentByName(bucketConversions, "Growth"),
              accentClass: "text-[#7C3AED] dark:text-[#A78BFA]",
            },
            {
              label: "Swing",
              value: getPercentByName(bucketConversions, "Swing"),
              accentClass: "text-[#8B5CF6] dark:text-[#C4B5FD]",
            },
          ]}
          gridClassName="grid-cols-2 md:grid-cols-4"
        />

        <AlignmentMeter
          tierConversions={tierConversions}
          bucketConversions={bucketConversions}
        />
      </div>
    </section>
  );
}

function AllocationSection({
  title,
  description,
  conversions,
  cards,
  gridClassName,
}: {
  title: string;
  description: string;
  conversions: Slice[];
  cards: Array<{
    label: string;
    value: number;
    accentClass: string;
  }>;
  gridClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241533] dark:bg-[#140D20]">
      <div className="mb-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B5A86] dark:text-[#BFA9F5]">
          {title}
        </p>
        <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
          {description}
        </p>
      </div>

      <div className="h-[240px] w-full">
        <Chart conversions={conversions as ConversionBucket[]} />
      </div>

      <div className={`mt-3 grid gap-2 ${gridClassName}`}>
        {cards.map((card) => (
          <SleeveCard
            key={card.label}
            label={card.label}
            value={card.value}
            accentClass={card.accentClass}
          />
        ))}
      </div>
    </div>
  );
}

function AlignmentMeter({
  tierConversions,
  bucketConversions,
}: {
  tierConversions: Slice[];
  bucketConversions: Slice[];
}) {
  const tier0 = getPercentByName(tierConversions, "Tier 0");
  const tier1 = getPercentByName(tierConversions, "Tier 1");
  const tier2 = getPercentByName(tierConversions, "Tier 2");

  const stable = getPercentByName(bucketConversions, "Stable Core");
  const rotational = getPercentByName(bucketConversions, "Rotational Core");
  const growth = getPercentByName(bucketConversions, "Growth");
  const swing = getPercentByName(bucketConversions, "Swing");

  let score = 0;

  if (tier0 >= 5) score += 20;
  if (tier1 >= 5) score += 20;
  if (tier2 <= 85) score += 15;

  if (stable >= 10) score += 15;
  if (rotational >= 10) score += 10;
  if (growth <= 70) score += 10;
  if (swing <= 10) score += 10;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const label =
    score >= 75
      ? "Strong Alignment"
      : score >= 50
      ? "Moderate Alignment"
      : "Low Alignment";

  const insight = buildAlignmentInsight({
    tier0,
    tier1,
    tier2,
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

function getNodeValueByKey(nodes: StrategyFlowNode[], key: string) {
  const match = nodes.find((node) => node.key === key);
  return Number(match?.total_value_usd) || 0;
}

function getRawValueByName(
  conversions: Slice[],
  name: string
) {
  const item = conversions.find((entry) => entry.name === name);
  return Number(item?.value) || 0;
}

function getPercentByName(
  conversions: Slice[],
  name: string
) {
  const total = conversions.reduce(
    (sum, entry) => sum + (Number(entry.value) || 0),
    0
  );

  if (total <= 0) return 0;

  const rawValue = getRawValueByName(conversions, name);
  return (rawValue / total) * 100;
}

function buildAlignmentInsight(values: {
  tier0: number;
  tier1: number;
  tier2: number;
  stable: number;
  rotational: number;
  growth: number;
  swing: number;
}) {
  if (values.tier2 >= 85 && values.growth >= 70) {
    return "Portfolio remains heavily tilted toward direct growth allocation.";
  }

  if (values.tier0 >= 20 && values.tier1 >= 20 && values.swing <= 10) {
    return "Structure is becoming more balanced across foundational, collateralized, and direct layers.";
  }

  if (values.tier0 < 5 && values.tier1 < 5) {
    return "Foundational and collateralized tiers remain underbuilt relative to direct allocation.";
  }

  if (values.swing > 10) {
    return "Elevated swing exposure is weakening overall MMII structural alignment.";
  }

  return "Structure is progressing, but core foundational and rotational layers still need reinforcement.";
}