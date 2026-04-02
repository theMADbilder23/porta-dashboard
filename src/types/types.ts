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
  stable_yield_value: number | null;
  growth_risk_yield_value: number | null;
  hard_asset_yield_value: number | null;
  total_value_distributed: number | null;
  stable_daily_yield: number | null;
  growth_risk_daily_yield: number | null;
  hard_asset_daily_yield: number | null;
  total_daily_yield: number | null;
  stable_avg_apy: number | null;
  growth_risk_avg_apy: number | null;
  hard_asset_avg_apy: number | null;
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

export type YieldSummarySource = {
  label: "Stable Yield" | "Hard Asset Yield" | "Growth / Risk Yield";
  color: string;
  value: number;
  avgYield: number;
  distributionPercentage: number;
  dailyYield: number;
};

export type BlockchainAccountHoldingItem = {
  token_symbol: string;
  token_name: string;
  network: string;
  amount: number;
  value_usd: number;
  wallet_share_pct: number;
  price_usd: number;
  yield_contribution: number;
  classification: string;
  category: string | null;
  protocol: string | null;
};

export type BlockchainAccountSummaryItem = {
  wallet_id: string;
  wallet_name: string;
  role: string;
  network_group: string | null;
  total_value: number;
  yield_contribution: number;
  portfolio_share_pct: number;
  snapshot_time: string | null;
  chains: string[];
  holdings_value_sum: number;
  holdings_count: number;
  holdings: BlockchainAccountHoldingItem[];
};

export type BlockchainAccountsSummaryResponse = {
  total_blockchain_value: number;
  yield_contribution: number;
  active_accounts: number;
  chains_covered: number;
  accounts: BlockchainAccountSummaryItem[];
};

export type BlockchainAccountSummaryItem = {
  wallet_id: string;
  wallet_name: string;
  role: string;
  network_group: string | null;
  total_value: number;
  yield_contribution: number;
  portfolio_share_pct: number;
  snapshot_time: string | null;
  chains: string[];
  holdings_value_sum: number;
  holdings_count: number;
};

export type BlockchainAccountsSummaryResponse = {
  total_blockchain_value: number;
  yield_contribution: number;
  active_accounts: number;
  chains_covered: number;
  accounts: BlockchainAccountSummaryItem[];
};