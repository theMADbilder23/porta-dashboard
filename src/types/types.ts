import type { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type TicketMetric = {
  date: string;
  type: "created" | "resolved";
  count: number;
};

export type OverviewResponse = {
  timeframe: string;
  total_portfolio_value: number | null;
  stable_value: number | null;
  rotational_value: number | null;
  growth_value: number | null;
  swing_value: number | null;
  realized_gains: number | null;
  realized_losses: number | null;
  passive_income: number | null;
  total_portfolio_value_change_pct: number | null;
  passive_income_change_pct: number | null;
  realized_gains_change_pct: null;
  realized_losses_change_pct: null;
  allocation_scope_label?: string | null;
};

export type ConversionBucketName =
  | "Stable Core"
  | "Rotational Core"
  | "Growth"
  | "Swing";

export type ConversionBucket = {
  name: ConversionBucketName;
  value: number;
  color: string;
};