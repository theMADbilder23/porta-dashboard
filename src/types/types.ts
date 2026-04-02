export type BlockchainAccountRewardItem = {
  asset_id: string | null;
  token_symbol: string;
  token_name: string;
  network: string;
  amount: number;
  value_usd: number;
  price_usd: number;
  asset_class: string | null;
  yield_profile: string | null;
  mmii_bucket: string | null;
  mmii_subclass: string | null;
  price_source: string | null;
  position_role: string | null;
  is_yield_position: boolean;
  category: string | null;
  protocol: string | null;
};

export type BlockchainAccountHoldingItem = {
  asset_id: string | null;
  token_symbol: string;
  token_name: string;
  network: string;
  amount: number;
  value_usd: number;
  wallet_share_pct: number;
  price_usd: number;
  yield_contribution: number;
  asset_class: string | null;
  yield_profile: string | null;
  mmii_bucket: string | null;
  mmii_subclass: string | null;
  price_source: string | null;
  position_role: string | null;
  is_yield_position: boolean;
  category: string | null;
  protocol: string | null;
  rewards: BlockchainAccountRewardItem[];
};

export type BlockchainAccountSummaryItem = {
  wallet_id: string;
  wallet_name: string;
  wallet_address: string | null;
  role: string;
  network_group: string | null;
  total_value: number;
  yield_contribution: number;
  portfolio_share_pct: number;
  snapshot_time: string | null;
  chains: string[];
  holdings_value_sum: number;
  holdings_count: number;
  raw_holdings_count: number;
  holdings: BlockchainAccountHoldingItem[];
};

export type BlockchainAccountsSummaryResponse = {
  total_blockchain_value: number;
  yield_contribution: number;
  active_accounts: number;
  chains_covered: number;
  accounts: BlockchainAccountSummaryItem[];
};