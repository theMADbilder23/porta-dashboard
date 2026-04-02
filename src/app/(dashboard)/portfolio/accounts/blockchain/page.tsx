"use client";

import { useBlockchainAccountsSummary } from "@/hooks/use-blockchain-accounts-summary";

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
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

export default function BlockchainAccountsPage() {
  const { data, isLoading, error } = useBlockchainAccountsSummary();
  const accounts = data?.accounts ?? [];

  return (
    <div className="space-y-6 p-6">
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
              Live account shell
            </span>
            <span className="rounded-full border border-[#E9DAFF] bg-[#F7F1FF] px-3 py-1 text-xs font-medium text-[#6D28D9] dark:border-[#312047] dark:bg-[#1A1226] dark:text-[#D8B4FE]">
              Data wiring next
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
        <div className="flex flex-col gap-4 desktop:flex-row desktop:items-center">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
              Search Accounts
            </label>
            <div className="rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#8A79A8] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#A78BCE]">
              Search by wallet name, chain, or role...
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3 desktop:w-[520px]">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Role
              </label>
              <div className="rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#8A79A8] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#A78BCE]">
                All roles
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Chain
              </label>
              <div className="rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#8A79A8] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#A78BCE]">
                All chains
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Sort
              </label>
              <div className="rounded-xl border border-[#E9DAFF] bg-[#FCFAFF] px-4 py-3 text-sm text-[#8A79A8] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#A78BCE]">
                Highest value
              </div>
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
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
              No blockchain accounts available yet.
            </p>
          </div>
        ) : (
          accounts.map((account) => {
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
                        Account Detail Preview
                      </h3>
                      <p className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                        Holdings table, protocol exposure, chain breakdown, and yield
                        rows will expand here in the next build step.
                      </p>
                    </div>

                    <button className="rounded-xl border border-[#D9C7FF] bg-white px-4 py-2 text-sm font-medium text-[#6D28D9] transition-colors hover:bg-[#F3E8FF] dark:border-[#3A2559] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}