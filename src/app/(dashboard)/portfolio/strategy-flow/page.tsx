"use client";

import { useEffect, useMemo, useState } from "react";

type StrategyFlowResponse = {
  summary: {
    total_branches: number;
    tracked_wallets: number;
    total_portfolio_value: number;
    alignment_score: number;
    dominant_branch: string;
  };
  branches: Array<{
    key: string;
    label: string;
    description: string;
    total_value_usd: number;
    allocation_pct: number;
    wallet_count: number;
    wallets: Array<{
      wallet_id: string | null;
      wallet_name: string;
      wallet_address: string | null;
      wallet_address_short: string;
      role: string;
      wallet_type: string;
      network_group: string;
      status: string;
      branch_key: string;
      branch_label: string;
      total_value_usd: number;
      allocation_pct: number;
      snapshot_time: string | null;
    }>;
  }>;
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

function getBranchAccentClasses(branchKey: string) {
  switch (branchKey) {
    case "stable_core":
      return {
        pill: "bg-[#ECFDF3] text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]",
        bar: "bg-[#22C55E]",
      };
    case "rotational_core":
      return {
        pill: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
        bar: "bg-[#A855F7]",
      };
    case "growth":
      return {
        pill: "bg-[#EEF4FF] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]",
        bar: "bg-[#3B82F6]",
      };
    case "swing":
      return {
        pill: "bg-[#FFF4E5] text-[#B45309] dark:bg-[#2A1A0C] dark:text-[#FBBF24]",
        bar: "bg-[#F59E0B]",
      };
    default:
      return {
        pill: "bg-[#F3F4F6] text-[#374151] dark:bg-[#1F2937] dark:text-[#D1D5DB]",
        bar: "bg-[#9CA3AF]",
      };
  }
}

function getAlignmentTone(score: number) {
  if (score >= 75) return "High Alignment";
  if (score >= 45) return "Moderate Alignment";
  return "Low Alignment";
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
  const branches = data?.branches ?? [];

  const alignmentTone = useMemo(
    () => getAlignmentTone(safeNumber(summary?.alignment_score)),
    [summary?.alignment_score]
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
              Visual representation of the MMII strategy structure. This page maps
              how capital flows through each strategic layer and how wallets,
              accounts, and future structure branches sit inside the broader MMII
              system.
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
              label="Strategy Branches"
              value={String(summary?.total_branches ?? 0)}
              sublabel="Stable / Rotational / Growth / Swing"
            />

            <MetricCard
              label="Tracked Wallets"
              value={String(summary?.tracked_wallets ?? 0)}
              sublabel="Active MMII structure entries"
            />

            <MetricCard
              label="Alignment Score"
              value={`${safeNumber(summary?.alignment_score)}/100`}
              sublabel={alignmentTone}
            />

            <MetricCard
              label="Dominant Branch"
              value={summary?.dominant_branch || "—"}
              sublabel={formatCompactCurrency(summary?.total_portfolio_value ?? 0)}
            />
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Strategy Flow Map
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                High-level structural preview of capital distribution across MMII
                branches. This large canvas is reserved for the future tree-flow
                diagram, while the branch cards below provide the first real live
                data layer for the structure engine.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[#D8B4FE] bg-[#FCFAFF] p-6 dark:border-[#3B2A57] dark:bg-[#140D20]">
              <div className="grid grid-cols-1 gap-4 desktop:grid-cols-4">
                {branches.map((branch) => {
                  const accent = getBranchAccentClasses(branch.key);

                  return (
                    <div
                      key={branch.key}
                      className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#312047] dark:bg-[#100A19]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${accent.pill}`}
                        >
                          {branch.label}
                        </span>
                        <span className="text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                          {formatPercent(branch.allocation_pct)}
                        </span>
                      </div>

                      <p className="mt-3 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCompactCurrency(branch.total_value_usd)}
                      </p>

                      <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                        {branch.wallet_count} wallet{branch.wallet_count === 1 ? "" : "s"}
                      </p>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EFE7FF] dark:bg-[#241533]">
                        <div
                          className={`h-full ${accent.bar}`}
                          style={{ width: `${Math.max(2, safeNumber(branch.allocation_pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl bg-[#F8F4FF] px-4 py-3 text-sm text-[#6B5A86] dark:bg-[#100A19] dark:text-[#BFA9F5]">
                {data.methodology?.note ||
                  "This structure view currently uses first-pass MMII branch mapping logic."}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
            {branches.map((branch) => {
              const accent = getBranchAccentClasses(branch.key);

              return (
                <div
                  key={branch.key}
                  className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]"
                >
                  <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${accent.pill}`}
                        >
                          {branch.label}
                        </span>
                        <span className="text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                          {formatPercent(branch.allocation_pct)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCurrency(branch.total_value_usd)}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                        {branch.description}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F8F4FF] px-4 py-3 text-right dark:bg-[#140D20]">
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Wallet Count
                      </p>
                      <p className="mt-1 text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        {branch.wallet_count}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {branch.wallets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#D8B4FE] px-4 py-4 text-sm text-[#8B5CF6] dark:border-[#3B2A57] dark:text-[#C084FC]">
                        No wallets currently mapped into this branch.
                      </div>
                    ) : (
                      branch.wallets.map((wallet) => (
                        <div
                          key={`${branch.key}-${wallet.wallet_id ?? wallet.wallet_name}`}
                          className="rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 dark:border-[#312047] dark:bg-[#140D20]"
                        >
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
                              <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                                {formatPercent(wallet.allocation_pct)} of structure
                              </p>
                            </div>
                          </div>

                          <p className="mt-3 text-[11px] text-[#8A79A8] dark:text-[#A78BCE]">
                            Latest snapshot: {formatDateTime(wallet.snapshot_time)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
}