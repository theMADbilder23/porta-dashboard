"use client";

import { Activity } from "lucide-react";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";

export default function TicketByChannels() {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Portfolio Health" icon={Activity} />
      <div className="relative flex min-h-[320px] flex-1 flex-col justify-center">
        <Chart />
      </div>
    </section>
  );
}