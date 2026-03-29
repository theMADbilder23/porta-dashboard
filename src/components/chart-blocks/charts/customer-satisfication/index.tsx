"use client";

import { Coins, Landmark, TrendingUp, Zap } from "lucide-react";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";
import { buildYieldSourcesFromOverview } from "../../../../data/customer-satisfaction";
import { useOverview } from "@/hooks/use-overview";
import { formatUsdRounded } from "@/lib/utils";

const icons = {
  "Stable Yield": <Landmark className="h-5 w-5 stroke-[#A855F7]" />,
  "Hard Asset Yield": <TrendingUp className="h-5 w-5 stroke-[#7C3AED]" />,
  "Growth / Risk Yield": <Zap className="h-5 w-5 stroke-[#C084FC]" />,
} as const;

export default function CustomerSatisfaction() {
  const { data: overview } = useOverview();
  const yieldSources = buildYieldSourcesFromOverview(overview);
  const totalDistributed =
    yieldSources.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Yield Summary" icon={Coins} />
      <div className="my-4 flex h-full items-center justify-between">
        <div className="mx-auto grid w-full grid-cols-2 gap-6">
          <TotalDistributed value={totalDistributed} />
          {yieldSources.map((source) => (
            <LinearProgress
              key={source.label}
              label={source.label}
              color={source.color}
              value={source.value}
              avgYield={source.avgYield}
              distributionPercentage={source.distributionPercentage}
              dailyYield={source.dailyYield}
              icon={icons[source.label]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TotalDistributed({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-start justify-center">
      <div className="text-xs text-muted-foreground">Total Value Distributed</div>
      <div className="text-2xl font-medium">{formatUsdRounded(value)}</div>
    </div>
  );
}