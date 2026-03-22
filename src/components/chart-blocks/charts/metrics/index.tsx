"use client";

import { useAtomValue } from "jotai";
import { TrendingDown, TrendingUp, WalletCards, HandCoins } from "lucide-react";
import Container from "../../../../components/container";
import OverviewTimeframeTabs from "../../../../components/overview-timeframe-tabs";
import { overviewHeaderData, overviewTimeframeAtom } from "../../../../lib/atoms/overview";
import MetricCard from "./components/metric-card";

export default function Metrics() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const metrics = overviewHeaderData[timeframe];

  return (
    <section className="border-b border-border">
      <Container className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-sm text-muted-foreground">
              MMII portfolio intelligence across your selected timeframe
            </p>
          </div>

          <OverviewTimeframeTabs />
        </div>

        <div className="grid grid-cols-1 gap-6 phone:grid-cols-2 desktop:grid-cols-4">
          <MetricCard
            title="Total Portfolio Value"
            value={metrics.totalPortfolioValue}
            change={0.052}
            className="min-w-0"
            icon={<WalletCards size={16} />}
            helperText="vs selected period"
          />

          <MetricCard
            title="Realized Gains"
            value={metrics.realizedGains}
            change={0.084}
            className="min-w-0"
            icon={<TrendingUp size={16} />}
            helperText="vs selected period"
          />

          <MetricCard
            title="Realized Losses"
            value={metrics.realizedLosses}
            change={-0.021}
            className="min-w-0"
            icon={<TrendingDown size={16} />}
            helperText="vs selected period"
          />

          <MetricCard
            title="Total Passive Income"
            value={metrics.totalPassiveIncome}
            change={0.068}
            className="min-w-0"
            icon={<HandCoins size={16} />}
            helperText="vs selected period"
          />
        </div>
      </Container>
    </section>
  );
}