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
      return "vs previous day";
    case "weekly":
      return "vs previous week";
    case "monthly":
      return "vs previous month";
    case "quarterly":
      return "vs previous quarter";
    case "yearly":
      return "vs previous year";
    default:
      return "vs selected period";
  }
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

  function isActive(metric: OverviewMetricKey) {
    return selectedMetric === metric;
  }

  return (
    <section className="border-b border-border bg-transparent">
      <Container className="py-5">
        <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#2D1B45] dark:text-[#F3E8FF]">
                  Overview
                </h1>
                <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                  MMII portfolio intelligence across your selected timeframe
                </p>
                <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                  All values displayed in USD
                </p>
              </div>

              <OverviewTimeframeTabs />
            </div>

            <div className="grid grid-cols-1 gap-4 phone:grid-cols-2 desktop:grid-cols-4">
              <MetricCard
                title="Total Portfolio Value"
                value={metrics.totalPortfolioValue}
                change={changes.totalPortfolioValue}
                active={isActive("totalPortfolioValue")}
                onClick={() => setSelectedMetric("totalPortfolioValue")}
                className="min-w-0"
                icon={<WalletCards size={16} />}
                helperText="vs selected period range"
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
                title={passiveIncomeTitle}
                value={metrics.totalPassiveIncome}
                change={changes.totalPassiveIncome}
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