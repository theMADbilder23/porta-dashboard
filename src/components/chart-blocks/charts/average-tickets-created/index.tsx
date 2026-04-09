"use client";

import { TrendingUp } from "lucide-react";
import ChartTitle from "../components/chart-title";
import Chart from "./chart";

export default function AverageTicketsCreated() {
  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ChartTitle
          title="Portfolio Performance"
          icon={TrendingUp}
          className="text-base md:text-lg"
        />
      </div>

      <div className="relative h-[400px] w-full flex-1">
        <Chart />
      </div>
    </section>
  );
}