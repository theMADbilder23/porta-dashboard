"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { TrendingDown, TrendingUp, WalletCards, HandCoins } from "lucide-react";
import Container from "../../../../../components/container";
import OverviewTimeframeTabs from "../../../../../components/overview-timeframe-tabs";
import { overviewTimeframeAtom } from "@/lib/atoms/overview-header";
import MetricCard from "./components/metric-card";

export default function Metrics() {

  const timeframe = useAtomValue(overviewTimeframeAtom);

  const apiTimeframe = useMemo(() => {
    switch (timeframe) {
      case "daily":
        return "daily";
      case "weekly":
        return "weekly";
      case "monthly":
        return "monthly";
      case "quarterly":
        return "quarterly";
      case "yearly":
        return "yearly";
      default:
        return "daily";
    }
  }, [timeframe]);

  const [apiData, setApiData] = useState<{
    total_portfolio_value: number;
    passive_income: number;
    realized_gains: number | null;
    realized_losses: number | null;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/overview?timeframe=${apiTimeframe}`);
        const data = await res.json();
        setApiData(data);
      } catch (_error) {
        return;
      }
    }

    fetchData();
  }, [apiTimeframe]);
  
  const metrics = {
    totalPortfolioValue:
      apiData?.total_portfolio_value != null
        ? `$${Number(apiData.total_portfolio_value).toLocaleString()}`
        : "N/A",
    realizedGains: "N/A",
    realizedLosses: "N/A",
    totalPassiveIncome:
      apiData?.passive_income != null
        ? `$${Number(apiData.passive_income).toLocaleString()}`
        : "N/A",
  };

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
            value={"N/A"}
            change={0.084}
            className="min-w-0"
            icon={<TrendingUp size={16} />}
            helperText="vs selected period"
          />

          <MetricCard
            title="Realized Losses"
            value={"N/A"}
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