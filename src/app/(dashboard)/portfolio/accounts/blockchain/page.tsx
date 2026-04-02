"use client";

import { useMemo, useState } from "react";
import { useBlockchainAccountsSummary } from "@/hooks/use-blockchain-accounts-summary";

type SortOption = "highest" | "lowest" | "recent";

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safeValue);

  if (abs >= 1_000_000_000) return `$${(safeValue / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(safeValue / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(safeValue / 1_000).toFixed(2)}K`;

  return formatCurrency(safeValue);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";

  if (value >= 1) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }

  if (value >= 0.01) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toFixed(8)}`;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value) || value === 0) return "—";

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

function formatRelativeMinutes(snapshotTime: string | null) {
  if (!snapshotTime) return "Unknown";

  const timestamp = new Date(snapshotTime).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes === 1) return "1 min ago";
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function getStatusFromChains(chains: string[]) {
  if (chains.length === 0) return "Monitoring";
  return "Synced";
}

function getExposureText(
  role: string,
  chains: string[],
  yieldContribution: number
) {
  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole === "hub") {
    return "Growth-heavy with active protocol rewards";
  }

  if (normalizedRole === "yield") {
    return "Primary yield concentration across protocol positions";
  }

  if (chains.some((chain) => chain.toLowerCase() === "qubic")) {
    return yieldContribution > 0
      ? "Dividend-style asset tracking with active yield contribution"
      : "Dividend-style asset tracking and balance monitoring";
  }

  if (yieldContribution > 0) {
    return "Live blockchain account with active yield contribution";
  }

  return "Operational blockchain account with live balance visibility";
}

function getClassificationPillClasses(classification: string) {
  const normalized = String(classification || "").toLowerCase();

  if (normalized === "stable core") {
    return "bg-[#ECFDF3] text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]";
  }

  if (normalized === "growth") {
    return "bg-[#EEF4FF] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]";
  }

  if (normalized === "swing") {
    return "bg-[#FFF4E5] text-[#B45309] dark:bg-[#2A1A0C] dark:text-[#FBBF24]";
  }

  return "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]";
}

export default function BlockchainAccountsPage() {
  const { data, isLoading, error } = useBlockchainAccountsSummary();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [chainFilter, setChainFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("highest");
  const [expandedWalletIds, setExpandedWalletIds] = useState<string[]>([]);

  const accounts = data?.accounts || [];

  const roleOptions = useMemo(() => {
    const roles = Array.from(
      new Set(
        accounts
          .map((account) => String(account.role || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return roles;
  }, [accounts]);

  const chainOptions = useMemo(() => {
    const chains = Array.from(
      new Set(
        accounts.flatMap((account) =>
          (account.chains ?? []).map((chain) => String(chain || "").trim())
        )
      )
    ).filter(Boolean);

    return chains.sort((a, b) => a.localeCompare(b));
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = accounts.filter((account) => {
      const holdings = account.holdings ?? [];

      const matchesSearch =
        !query ||
        account.wallet_name.toLowerCase().includes(query) ||
        account.role.toLowerCase().includes(query) ||
        (account.network_group || "").toLowerCase().includes(query) ||
        account.chains.some((chain) => chain.toLowerCase().includes(query)) ||
        holdings.some(
          (holding) =>
            holding.token_symbol.toLowerCase().includes(query) ||
            holding.token_name.toLowerCase().includes(query)
        );

      const matchesRole =
        roleFilter === "all" ||
        account.role.toLowerCase() === roleFilter.toLowerCase();

      const matchesChain =
        chainFilter === "all" ||
        account.chains.some(
          (chain) => chain.toLowerCase() === chainFilter.toLowerCase()
        );

      return matchesSearch && matchesRole && matchesChain;
    });

    filtered.sort((a, b) => {
      if (sortOption === "lowest") {
        return a.total_value - b.total_value;
      }

      if (sortOption === "recent") {
        const aTime = new Date(a.snapshot_time || 0).getTime();
        const bTime = new Date(b.snapshot_time || 0).getTime();
        return bTime - aTime;
      }

      return b.total_value - a.total_value;
    });

    return filtered;
  }, [accounts, searchQuery, roleFilter, chainFilter, sortOption]);

  function toggleExpanded(walletId: string) {
    setExpandedWalletIds((current) =>
      current.includes(walletId)
        ? current.filter((id) => id !== walletId)
        : [...current, walletId]
    );
  }

  return (
    <div className="min-h-screen space-y-6 p-6">
      <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="flex flex-col gap-4 laptop:flex-row laptop:items-end laptop:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6] dark:text-[#C084FC]">
              Portfolio / Accounts
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
              Blockchain Accounts
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
              Operational inspection for on-chain wallets, balances, protocol
              exposure, yield positions, chain distribution, and sync visibility
              across the blockchain side of Porta.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#E9DAFF] bg-[#F7F1FF] px-3 py-1 text-xs font-medium text-[#6D28D9] dark:border-[#312047] dark:bg-[#1A1226] dark:text-[#D8B4FE]">
              Asset-level inspection
            </span>
            <span className="rounded-full border border-[#E9DAFF] bg-[#F7F1FF] px-3 py-1 text-xs font-medium text-[#6D28D9] dark:border-[#312047] dark:bg-[#1A1226] dark:text-[#D8B4FE]">
              Holdings search enabled
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
        <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Total Blockchain Value
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {isLoading
              ? "—"
              : formatCurrency(data?.total_blockchain_value ?? 0)}
          </h2>
          <p className="mt-2 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
            Combined value across tracked blockchain accounts.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Yield Contribution
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {isLoading ? "—" : formatCurrency(data?.yield_contribution ?? 0)}
          </h2>
          <p className="mt-2 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
            Snapshot-level contribution from live on-chain yield sources.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Active Accounts
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {isLoading ? "—" : data?.active_accounts ?? 0}
          </h2>
          <p className="mt-2 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
            Accounts currently expected to feed operational blockchain data.
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Chains Covered
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {isLoading ? "—" : data?.chains_covered ?? 0}
          </h2>
          <p className="mt-2 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
            Current visible chain groups across tracked blockchain accounts.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="flex flex-col gap-4 desktop:flex-row desktop:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
              Search Accounts
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by wallet, chain, role, token symbol, or token name..."
              className="w-full rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#2D1B45] outline-none transition-colors placeholder:text-[#8A79A8] focus:border-[#C084FC] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF] dark:placeholder:text-[#A78BCE]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3 desktop:w-[520px]">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#2D1B45] outline-none transition-colors focus:border-[#C084FC] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF]"
              >
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Chain
              </label>
              <select
                value={chainFilter}
                onChange={(event) => setChainFilter(event.target.value)}
                className="w-full rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#2D1B45] outline-none transition-colors focus:border-[#C084FC] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF]"
              >
                <option value="all">All chains</option>
                {chainOptions.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Sort
              </label>
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
                className="w-full rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#2D1B45] outline-none transition-colors focus:border-[#C084FC] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF]"
              >
                <option value="highest">Highest value</option>
                <option value="lowest">Lowest value</option>
                <option value="recent">Most recent</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-[#F5C2E7] bg-[#FFF5FA] p-5 text-sm text-[#9D174D] dark:border-[#4A1D33] dark:bg-[#1A0F18] dark:text-[#F9A8D4]">
          Failed to load blockchain accounts: {error}
        </section>
      ) : null}

      <section className="space-y-4">
        {isLoading ? (
          <div className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
              Loading blockchain account cards...
            </p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
              No blockchain accounts match your current search/filter settings.
            </p>
          </div>
        ) : (
          filteredAccounts.map((account) => {
            const roleLabel = account.role || "Unknown";
            const chainLabel =
              account.chains.length > 0
                ? account.chains.join(", ")
                : account.network_group || "Unknown";
            const statusLabel = getStatusFromChains(account.chains);
            const exposureText = getExposureText(
              account.role,
              account.chains,
              account.yield_contribution
            );
            const isExpanded = expandedWalletIds.includes(account.wallet_id);

            return (
              <div
                key={account.wallet_id}
                className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-[#2A1D3B] dark:bg-[#100A19]"
              >
                <div className="flex flex-col gap-5 desktop:flex-row desktop:items-start desktop:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        {account.wallet_name}
                      </h2>

                      <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]">
                        {roleLabel}
                      </span>

                      <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]">
                        {chainLabel}
                      </span>

                      <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-medium text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]">
                        {statusLabel}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                      {exposureText}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-4 tablet:grid-cols-4">
                      <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                          Total Value
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatCurrency(account.total_value)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                          Yield Contribution
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                          {account.yield_contribution > 0
                            ? formatCurrency(account.yield_contribution)
                            : "—"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                          % of Portfolio
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatPercent(account.portfolio_share_pct)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                        <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                          Last Updated
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                          {formatRelativeMinutes(account.snapshot_time)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="desktop:w-[320px]">
                    <div className="rounded-2xl border border-dashed border-[#D9C7FF] bg-[#FCFAFF] p-4 dark:border-[#3A2559] dark:bg-[#140D20]">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                        Debug Snapshot Check
                      </p>

                      <div className="mt-4 space-y-3 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                        <div className="flex items-center justify-between gap-3">
                          <span>Snapshot Total</span>
                          <span className="font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {formatCurrency(account.total_value)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span>Holdings Sum</span>
                          <span className="font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {formatCurrency(account.holdings_value_sum)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span>Holdings Count</span>
                          <span className="font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {account.holdings_count}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span>Tracked Chains</span>
                          <span className="font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {account.chains.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-[#F0E8FF] bg-[#FCFAFF] p-4 dark:border-[#2A1D3B] dark:bg-[#140D20]">
                  <div className="flex flex-col gap-4 desktop:flex-row desktop:items-center desktop:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        Account Detail View
                      </h3>
                      <p className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                        Asset-level holdings, value concentration, yield contribution,
                        and MMII classification for this wallet.
                      </p>
                    </div>

                    <button
                      onClick={() => toggleExpanded(account.wallet_id)}
                      className="rounded-xl border border-[#D9C7FF] bg-white px-4 py-2 text-sm font-medium text-[#6D28D9] transition-colors hover:bg-[#F3E8FF] dark:border-[#3A2559] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="mt-5 space-y-5">
                      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-5">
                        <div className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#312047] dark:bg-[#100A19]">
                          <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Wallet ID
                          </p>
                          <p className="mt-2 break-all text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {account.wallet_id}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#312047] dark:bg-[#100A19]">
                          <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Role
                          </p>
                          <p className="mt-2 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {account.role}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#312047] dark:bg-[#100A19]">
                          <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Network Group
                          </p>
                          <p className="mt-2 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {account.network_group || "Unknown"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#312047] dark:bg-[#100A19]">
                          <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Chains Covered
                          </p>
                          <p className="mt-2 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {account.chains.length > 0
                              ? account.chains.join(", ")
                              : "None detected"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E9DAFF] bg-white p-4 dark:border-[#312047] dark:bg-[#100A19]">
                          <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                            Holdings Count
                          </p>
                          <p className="mt-2 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                            {account.holdings_count}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19]">
                        <div className="border-b border-[#F0E8FF] px-4 py-3 dark:border-[#241533]">
                          <h4 className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                            Wallet Holdings
                          </h4>
                          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                            Sorted by highest USD value within this wallet.
                          </p>
                        </div>

                        {account.holdings.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                            No holdings were returned for this wallet’s latest snapshot.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                              <thead className="bg-[#FCFAFF] dark:bg-[#140D20]">
                                <tr className="border-b border-[#F0E8FF] dark:border-[#241533]">
                                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                                    Asset
                                  </th>
                                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                                    Value
                                  </th>
                                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                                    % Wallet
                                  </th>
                                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                                    Price
                                  </th>
                                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                                    Yield Contribution
                                  </th>
                                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                                    Classification
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {account.holdings.map((holding, index) => (
                                  <tr
                                    key={`${account.wallet_id}-${holding.token_symbol}-${holding.protocol ?? "none"}-${index}`}
                                    className="border-b border-[#F7F1FF] last:border-b-0 dark:border-[#1C1328]"
                                  >
                                    <td className="px-4 py-4 align-top">
                                      <div className="min-w-[220px]">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                                            {holding.token_symbol}
                                          </p>

                                          {holding.network ? (
                                            <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-medium text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]">
                                              {holding.network}
                                            </span>
                                          ) : null}
                                        </div>

                                        <p className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                                          {holding.token_name}
                                        </p>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {holding.protocol ? (
                                            <span className="rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]">
                                              {holding.protocol}
                                            </span>
                                          ) : null}

                                          {holding.category ? (
                                            <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[10px] font-medium text-[#7C3AED] dark:bg-[#1E1430] dark:text-[#C4B5FD]">
                                              {holding.category}
                                            </span>
                                          ) : null}
                                        </div>

                                        <p className="mt-2 text-xs text-[#8A79A8] dark:text-[#A78BCE]">
                                          Amount: {formatAmount(holding.amount)}
                                        </p>
                                      </div>
                                    </td>

                                    <td className="px-4 py-4 align-top">
                                      <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                                        {formatCurrency(holding.value_usd)}
                                      </p>
                                      <p className="mt-1 text-xs text-[#8A79A8] dark:text-[#A78BCE]">
                                        {formatCompactCurrency(holding.value_usd)}
                                      </p>
                                    </td>

                                    <td className="px-4 py-4 align-top">
                                      <p className="text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                                        {formatPercent(holding.wallet_share_pct)}
                                      </p>
                                    </td>

                                    <td className="px-4 py-4 align-top">
                                      <p className="text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                                        {formatPrice(holding.price_usd)}
                                      </p>
                                    </td>

                                    <td className="px-4 py-4 align-top">
                                      <p className="text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                                        {holding.yield_contribution > 0
                                          ? formatCurrency(holding.yield_contribution)
                                          : "—"}
                                      </p>
                                    </td>

                                    <td className="px-4 py-4 align-top">
                                      <span
                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getClassificationPillClasses(
                                          holding.classification
                                        )}`}
                                      >
                                        {holding.classification}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}