"use client";

import { TrendingUp } from "lucide-react";
import ChartTitle from "../../../../components/chart-title";
import Chart from "./chart";

export default function AverageTicketsCreated() {
  return (
    <section className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ChartTitle title="Portfolio Growth" icon={TrendingUp} />
      </div>

      <div className="relative h-[360px] w-full flex-1">
        <Chart />
      </div>
    </section>
  );
}