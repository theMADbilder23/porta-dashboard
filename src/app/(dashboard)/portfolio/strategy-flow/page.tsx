"use client";

import { useEffect, useMemo, useState } from "react";

type WalletNode = {
  wallet_id: string | null;
  wallet_name: string;
  wallet_address: string | null;
  wallet_address_short: string;
  role: string;
  wallet_type: string;
  network_group: string;
  status: string;
  bucket_key: string;
  bucket_label: string;
  tier_key: string;
  total_value_usd: number;
  snapshot_time: string | null;
};

type ExampleHolding = {
  asset_id: string;
  token_symbol: string;
  value_usd: number;
  yield_profile: string;
};

type StructureNode = {
  key: string;
  label: string;
  type: "root" | "tier" | "bucket" | "subclass";
  description: string;
  total_value_usd: number;
  allocation_pct: number;
  wallet_count: number;
  holding_count: number;
  children: StructureNode[];
  wallets: WalletNode[];
  meta?: {
    dominant_tier?: string;
    examples?: ExampleHolding[];
  };
};

type StrategyFlowResponse = {
  summary: {
    total_tiers: number;
    tracked_wallets: number;
    total_portfolio_value: number;
    dominant_tier: string;
  };
  structure: StructureNode;
  methodology?: {
    mapping_type?: string;
    note?: string;
  };
};

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatCurrency(value: number, digits = 2) {
  return `$${safeNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatCompactCurrency(value: number) {
  const safeValue = safeNumber(value);
  const abs = Math.abs(safeValue);

  if (abs >= 1_000_000_000) return `$${(safeValue / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(safeValue / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(safeValue / 1_000).toFixed(2)}K`;

  return formatCurrency(safeValue);
}

function formatPercent(value: number, digits = 1) {
  return `${safeNumber(value).toFixed(digits)}%`;
}

function formatDateTime(value: string | null) {
  if (!value) return "No snapshot";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No snapshot";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTierAccentClasses(tierKey: string) {
  switch (tierKey) {
    case "tier_0":
      return {
        pill: "bg-[#ECFDF3] text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]",
        line: "bg-[#22C55E]",
        soft: "bg-[#F4FFF7] dark:bg-[#0F1A13]",
      };
    case "tier_1":
      return {
        pill: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
        line: "bg-[#A855F7]",
        soft: "bg-[#FCF8FF] dark:bg-[#17111F]",
      };
    case "tier_2":
    default:
      return {
        pill: "bg-[#EEF4FF] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]",
        line: "bg-[#3B82F6]",
        soft: "bg-[#F8FBFF] dark:bg-[#101722]",
      };
  }
}

function getBucketAccentClasses(bucketKey: string) {
  switch (bucketKey) {
    case "stable_core":
      return {
        pill: "bg-[#ECFDF3] text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]",
      };
    case "rotational_core":
      return {
        pill: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "growth":
      return {
        pill: "bg-[#EEF4FF] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]",
      };
    case "swing":
      return {
        pill: "bg-[#FFF4E5] text-[#B45309] dark:bg-[#2A1A0C] dark:text-[#FBBF24]",
      };
    default:
      return {
        pill: "bg-[#F3F4F6] text-[#374151] dark:bg-[#1F2937] dark:text-[#D1D5DB]",
      };
  }
}

function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">{sublabel}</p>
      ) : null}
    </div>
  );
}

function SubclassCard({ node }: { node: StructureNode }) {
  const examples = node.meta?.examples ?? [];

  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 dark:border-[#312047] dark:bg-[#140D20]">
      <div className="flex flex-col gap-2 desktop:flex-row desktop:items-start desktop:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {node.label}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {node.holding_count} holding{node.holding_count === 1 ? "" : "s"}
          </p>
        </div>

        <div className="desktop:text-right">
          <p className="text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {formatCurrency(node.total_value_usd)}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {formatPercent(node.allocation_pct)} of structure
          </p>
        </div>
      </div>

      {examples.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((example) => (
            <span
              key={`${node.key}-${example.asset_id}-${example.token_symbol}`}
              className="rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]"
            >
              {example.token_symbol} • {example.yield_profile || "none"}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WalletCard({ wallet }: { wallet: WalletNode }) {
  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#312047] dark:bg-[#100A19]">
      <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {wallet.wallet_name}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]">
              {wallet.role}
            </span>
            <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-medium text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]">
              {wallet.network_group}
            </span>
            <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-medium text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]">
              {wallet.status}
            </span>
          </div>

          <p className="mt-2 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {wallet.wallet_address_short} • {wallet.wallet_type}
          </p>
        </div>

        <div className="desktop:text-right">
          <p className="text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {formatCurrency(wallet.total_value_usd)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#8A79A8] dark:text-[#A78BCE]">
        Latest snapshot: {formatDateTime(wallet.snapshot_time)}
      </p>
    </div>
  );
}

function BucketSection({ bucket }: { bucket: StructureNode }) {
  const accent = getBucketAccentClasses(bucket.key);

  return (
    <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${accent.pill}`}>
              {bucket.label}
            </span>
            <span className="text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
              {formatPercent(bucket.allocation_pct)}
            </span>
          </div>

          <h4 className="mt-3 text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {formatCurrency(bucket.total_value_usd)}
          </h4>

          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            {bucket.description}
          </p>
        </div>

        <div className="rounded-xl bg-[#F8F4FF] px-4 py-3 text-right dark:bg-[#140D20]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Wallet Count
          </p>
          <p className="mt-1 text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {bucket.wallet_count}
          </p>
        </div>
      </div>

      {bucket.children.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Subclass Structure
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 laptop:grid-cols-2">
            {bucket.children.map((subclass) => (
              <SubclassCard key={subclass.key} node={subclass} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
          Wallets In Bucket
        </p>

        <div className="mt-3 space-y-3">
          {bucket.wallets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8B4FE] px-4 py-4 text-sm text-[#8B5CF6] dark:border-[#3B2A57] dark:text-[#C084FC]">
              No wallets currently mapped into this bucket.
            </div>
          ) : (
            bucket.wallets.map((wallet) => (
              <WalletCard
                key={`${bucket.key}-${wallet.wallet_id ?? wallet.wallet_name}`}
                wallet={wallet}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TierSection({ tier }: { tier: StructureNode }) {
  const accent = getTierAccentClasses(tier.key);

  return (
    <section className="relative rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <div className="absolute left-6 top-0 h-6 w-[2px] -translate-y-full rounded-full bg-[#E9DAFF] dark:bg-[#2A1D3B]" />
      <div className={`absolute left-6 top-6 h-full w-[2px] rounded-full ${accent.line} opacity-30`} />

      <div className="relative ml-6">
        <div className={`rounded-2xl ${accent.soft} p-5`}>
          <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
            <div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${accent.pill}`}>
                {tier.label}
              </span>

              <h3 className="mt-3 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                {formatCurrency(tier.total_value_usd)}
              </h3>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                {tier.description}
              </p>
            </div>

            <div className="rounded-xl border border-[#E9DAFF] bg-white px-4 py-3 dark:border-[#312047] dark:bg-[#100A19]">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Tier Coverage
              </p>
              <p className="mt-1 text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                {formatPercent(tier.allocation_pct)}
              </p>
              <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                {tier.wallet_count} wallet{tier.wallet_count === 1 ? "" : "s"} • {tier.holding_count} holding{tier.holding_count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 desktop:grid-cols-2">
          {tier.children.map((bucket) => (
            <BucketSection key={bucket.key} bucket={bucket} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function StrategyFlowPage() {
  const [data, setData] = useState<StrategyFlowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/strategy-flow", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const json = (await response.json()) as StrategyFlowResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy flow");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = data?.summary;
  const structure = data?.structure;
  const tiers = structure?.children ?? [];

  const dominantTierLabel = useMemo(
    () => summary?.dominant_tier || structure?.meta?.dominant_tier || "—",
    [summary?.dominant_tier, structure?.meta?.dominant_tier]
  );

  return (
    <div className="min-h-screen space-y-6 p-6">
      <section className="rounded-2xl border border-[#E9DAFF] bg-gradient-to-br from-white to-[#F8F4FF] p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="flex flex-col gap-4 desktop:flex-row desktop:items-end desktop:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6] dark:text-[#C084FC]">
              Portfolio / Strategy Flow
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
              Strategy Flow / Structure
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
              Visual representation of the MMII strategy structure. This page is now
              oriented around structural tiers, strategic buckets, subclass groupings,
              and wallet placement within the broader MMII system.
            </p>
          </div>

          <div className="rounded-xl border border-[#E9DAFF] bg-white px-4 py-3 dark:border-[#312047] dark:bg-[#100A19]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
              Mapping Mode
            </p>
            <p className="mt-1 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
              {data?.methodology?.mapping_type || "Heuristic"}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-[#F5C2E7] bg-[#FFF5FA] p-5 text-sm text-[#9D174D] dark:border-[#4A1D33] dark:bg-[#1A0F18] dark:text-[#F9A8D4]">
          Failed to load Strategy Flow data: {error}
        </section>
      ) : null}

      {isLoading ? (
        <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
            Loading strategy structure...
          </p>
        </section>
      ) : null}

      {!isLoading && data ? (
        <>
          <section className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
            <MetricCard
              label="Structure Tiers"
              value={String(summary?.total_tiers ?? 0)}
              sublabel="Tier 0 / Tier 1 / Tier 2"
            />

            <MetricCard
              label="Tracked Wallets"
              value={String(summary?.tracked_wallets ?? 0)}
              sublabel="Active MMII structure entries"
            />

            <MetricCard
              label="Structure Value"
              value={formatCurrency(summary?.total_portfolio_value ?? 0)}
              sublabel="Total mapped portfolio value"
            />

            <MetricCard
              label="Dominant Tier"
              value={dominantTierLabel}
              sublabel="Highest-value structural layer"
            />
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                MMII Structural Tree
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                First live tree-oriented structure view of MMII. The hierarchy now
                flows from the MMII root into structural tiers, then strategic buckets,
                then subclass sleeves, and finally the wallets mapped into those sleeves.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[#D8B4FE] bg-[#FCFAFF] p-6 dark:border-[#3B2A57] dark:bg-[#140D20]">
              <div className="mx-auto max-w-2xl rounded-2xl border border-[#E9DAFF] bg-white p-6 text-center shadow-sm dark:border-[#312047] dark:bg-[#100A19]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                  MMII Root Structure
                </p>
                <h3 className="mt-2 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                  {formatCurrency(structure?.total_value_usd ?? 0)}
                </h3>
                <p className="mt-2 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                  {structure?.description ||
                    "Top-level MMII structural map showing how capital is organized through the system."}
                </p>
              </div>

              <div className="mt-8 space-y-6">
                {tiers.map((tier) => (
                  <TierSection key={tier.key} tier={tier} />
                ))}
              </div>

              <div className="mt-6 rounded-xl bg-[#F8F4FF] px-4 py-3 text-sm text-[#6B5A86] dark:bg-[#100A19] dark:text-[#BFA9F5]">
                {data.methodology?.note ||
                  "This structure view currently uses wallet metadata plus holdings classification fields."}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}