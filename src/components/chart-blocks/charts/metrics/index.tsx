"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  TrendingDown,
  TrendingUp,
  WalletCards,
  HandCoins,
} from "lucide-react";
import Container from "@/components/container";
import OverviewTimeframeTabs from "@/components/overview-timeframe-tabs";
import {
  overviewSelectedMetricAtom,
  overviewTimeframeAtom,
  type OverviewMetricKey,
  type OverviewTimeframe,
} from "@/lib/atoms/overview";
import MetricCard from "./components/metric-card";

type OverviewApiResponse = {
  total_portfolio_value: number | null;
  passive_income: number | null;
  realized_gains: number | null;
  realized_losses: number | null;
  total_portfolio_value_change_pct: number | null;
  passive_income_change_pct: number | null;
  realized_gains_change_pct: number | null;
  realized_losses_change_pct: number | null;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "N/A";

  return `$${
    Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })
  }`;
}

function toMetricChange(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Number(value);
}

function getYieldFlowTitle(timeframe: OverviewTimeframe) {
  switch (timeframe) {
    case "daily":
      return "Daily Yield Flow";
    case "weekly":
      return "Weekly Yield Flow";
    case "monthly":
      return "Monthly Yield Flow";
    case "quarterly":
      return "Quarterly Yield Flow";
    case "yearly":
      return "Yearly Yield Flow";
    default:
      return "Yield Flow";
  }
}

function getYieldFlowHelperText(timeframe: OverviewTimeframe) {
  switch (timeframe) {
    case "daily":
      return "from today’s low";
    case "weekly":
      return "from weekly low";
    case "monthly":
      return "from monthly low";
    case "quarterly":
      return "from quarterly low";
    case "yearly":
      return "from yearly low";
    default:
      return "from timeframe low";
  }
}

function getTpvHelperText(timeframe: OverviewTimeframe) {
  if (timeframe === "daily") {
    return "from today’s low";
  }

  return "from period low to avg";
}

function getTpvChangeTooltip(timeframe: OverviewTimeframe) {
  if (timeframe === "daily") {
    return "Shows the percentage move from the lowest Total Portfolio Value in today’s selected window to the current Total Portfolio Value.";
  }

  return "Shows the percentage move from the lowest Total Portfolio Value in the selected timeframe to the average Total Portfolio Value for that period.";
}

function getYieldFlowChangeTooltip(timeframe: OverviewTimeframe) {
  switch (timeframe) {
    case "daily":
      return "Shows the percentage move from the lowest claimable yield reading in today’s selected window to the current claimable yield reading.";
    case "weekly":
      return "Shows the percentage move from the lowest claimable yield reading in the selected week to the current claimable yield reading.";
    case "monthly":
      return "Shows the percentage move from the lowest claimable yield reading in the selected month to the current claimable yield reading.";
    case "quarterly":
      return "Shows the percentage move from the lowest claimable yield reading in the selected quarter to the current claimable yield reading.";
    case "yearly":
      return "Shows the percentage move from the lowest claimable yield reading in the selected year to the current claimable yield reading.";
    default:
      return "Shows the percentage move from the timeframe low to the current claimable yield reading.";
  }
}

export default function Metrics() {
  const timeframe = useAtomValue(overviewTimeframeAtom);
  const [selectedMetric, setSelectedMetric] = useAtom(
    overviewSelectedMetricAtom,
  );

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
        const res = await fetch(`/api/overview?timeframe=${apiTimeframe}`, {
          cache: "no-store",
        });
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

  const passiveIncomeTitle = getYieldFlowTitle(timeframe);
  const passiveIncomeHelperText = getYieldFlowHelperText(timeframe);
  const tpvHelperText = getTpvHelperText(timeframe);

  function isActive(metric: OverviewMetricKey) {
    return selectedMetric === metric;
  }

  return (
    <section className="border-b border-border bg-transparent">
      <Container className="py-3 md:py-4">
        <div className="rounded-2xl border border-[#E9DAFF] bg-white p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19] md:p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-[2rem] font-bold tracking-tight text-[#2D1B45] dark:text-[#F3E8FF]">
                  Overview
                </h1>
                <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                  MMII portfolio intelligence across your selected timeframe
                </p>
                <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                  All values displayed in USD
                </p>
              </div>

              <div className="shrink-0">
                <OverviewTimeframeTabs />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 phone:grid-cols-2 desktop:grid-cols-4">
              <MetricCard
                title="Total Portfolio Value"
                value={metrics.totalPortfolioValue}
                change={changes.totalPortfolioValue}
                changeTooltip={getTpvChangeTooltip(timeframe)}
                active={isActive("totalPortfolioValue")}
                onClick={() => setSelectedMetric("totalPortfolioValue")}
                className="min-w-0"
                icon={<WalletCards size={16} />}
                helperText={tpvHelperText}
              />

              <MetricCard
                title="Realized Gains"
                value={metrics.realizedGains}
                change={changes.realizedGains}
                changeTooltip="Shows the selected realized gains comparison percentage returned by the overview endpoint."
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
                changeTooltip="Shows the selected realized losses comparison percentage returned by the overview endpoint."
                active={isActive("realizedLosses")}
                onClick={() => setSelectedMetric("realizedLosses")}
                className="min-w-0"
                icon={<TrendingDown size={16} />}
                helperText="vs selected period"
              />

              <MetricCard
                title={passiveIncomeTitle}
                value={metrics.totalPassiveIncome}
                change={changes.totalPassiveIncome}
                changeTooltip={getYieldFlowChangeTooltip(timeframe)}
                active={isActive("totalPassiveIncome")}
                onClick={() => setSelectedMetric("totalPassiveIncome")}
                className="min-w-0"
                icon={<HandCoins size={16} />}
                helperText={passiveIncomeHelperText}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}