"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { TrendingDown, TrendingUp, WalletCards, HandCoins } from "lucide-react";
import Container from "@/components/container";
import OverviewTimeframeTabs from "@/components/overview-timeframe-tabs";
import {
  overviewSelectedMetricAtom,
  overviewTimeframeAtom,
  type OverviewMetricKey,
} from "@/lib/atoms/overview";
import MetricCard from "./components/metric-card";

type OverviewApiResponse = {
  total_portfolio_value: number | null;
  passive_income: number | null;
  realized_gains: number | null;
  realized_losses: number | null;
  total_portfolio_value_change_pct?: number | null;
  passive_income_change_pct?: number | null;
  realized_gains_change_pct?: number | null;
  realized_losses_change_pct?: number | null;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "N/A";

  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })}`;
}

function toMetricChange(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Number(value);
}

export default function Metrics() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const [selectedMetric, setSelectedMetric] = useAtom(overviewSelectedMetricAtom);

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

  const [apiData, setApiData] = useState<OverviewApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(`/api/overview?timeframe=${apiTimeframe}`);
        const data = await res.json();

        if (!cancelled) {
          setApiData(data);
        }
      } catch {
        if (!cancelled) {
          setApiData(null);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [apiTimeframe]);

  const metrics = {
    totalPortfolioValue: formatCurrency(apiData?.total_portfolio_value),
    realizedGains: formatCurrency(apiData?.realized_gains),
    realizedLosses: formatCurrency(apiData?.realized_losses),
    totalPassiveIncome: formatCurrency(apiData?.passive_income),
  };

  const changes = {
    totalPortfolioValue: toMetricChange(apiData?.total_portfolio_value_change_pct),
    realizedGains: toMetricChange(apiData?.realized_gains_change_pct),
    realizedLosses: toMetricChange(apiData?.realized_losses_change_pct),
    totalPassiveIncome: toMetricChange(apiData?.passive_income_change_pct),
  };

  function isActive(metric: OverviewMetricKey) {
    return selectedMetric === metric;
  }

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
            change={changes.totalPortfolioValue}
            active={isActive("totalPortfolioValue")}
            onClick={() => setSelectedMetric("totalPortfolioValue")}
            className="min-w-0"
            icon={<WalletCards size={16} />}
            helperText="vs selected period"
          />

          <MetricCard
            title="Realized Gains"
            value={metrics.realizedGains}
            change={changes.realizedGains}
            active={isActive("realizedGains")}
            onClick={() => setSelectedMetric("realizedGains")}
            className="min-w-0"
            icon={<TrendingUp size={16} />}
            helperText="vs selected period"
          />

          <MetricCard
            title="Realized Losses"
            value={metrics.realizedLosses}
            change={changes.realizedLosses}
            active={isActive("realizedLosses")}
            onClick={() => setSelectedMetric("realizedLosses")}
            className="min-w-0"
            icon={<TrendingDown size={16} />}
            helperText="vs selected period"
          />

          <MetricCard
            title="Total Passive Income"
            value={metrics.totalPassiveIncome}
            change={changes.totalPassiveIncome}
            active={isActive("totalPassiveIncome")}
            onClick={() => setSelectedMetric("totalPassiveIncome")}
            className="min-w-0"
            icon={<HandCoins size={16} />}
            helperText="vs selected period"
          />
        </div>
      </Container>
    </section>
  );
}