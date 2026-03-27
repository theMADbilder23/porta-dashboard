import { atom } from "jotai";

export type OverviewTimeframe =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type OverviewMetricKey =
  | "totalPortfolioValue"
  | "realizedGains"
  | "realizedLosses"
  | "totalPassiveIncome";

export const overviewTimeframeAtom = atom<OverviewTimeframe>("daily");

export const overviewSelectedMetricAtom =
  atom<OverviewMetricKey>("totalPortfolioValue");

export type OverviewHeaderMetrics = {
  totalPortfolioValue: string;
  realizedGains: string;
  realizedLosses: string;
  totalPassiveIncome: string;
};

export const overviewHeaderData: Record<OverviewTimeframe, OverviewHeaderMetrics> = {
  daily: {
    totalPortfolioValue: "$24,208",
    realizedGains: "$4,564",
    realizedLosses: "$1,218",
    totalPassiveIncome: "$312",
  },
  weekly: {
    totalPortfolioValue: "$24,980",
    realizedGains: "$5,140",
    realizedLosses: "$1,540",
    totalPassiveIncome: "$1,145",
  },
  monthly: {
    totalPortfolioValue: "$26,420",
    realizedGains: "$8,240",
    realizedLosses: "$2,160",
    totalPassiveIncome: "$3,420",
  },
  quarterly: {
    totalPortfolioValue: "$31,880",
    realizedGains: "$14,920",
    realizedLosses: "$4,210",
    totalPassiveIncome: "$8,760",
  },
  yearly: {
    totalPortfolioValue: "$46,300",
    realizedGains: "$28,500",
    realizedLosses: "$9,850",
    totalPassiveIncome: "$18,420",
  },
};