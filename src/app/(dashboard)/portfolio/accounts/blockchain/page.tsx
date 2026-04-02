export default function BlockchainAccountsPage() {
  const accountCards = [
    {
      name: "HUB Wallet",
      role: "Hub",
      chain: "Base",
      status: "Synced",
      value: "$18,420",
      yield: "$96.42",
      portfolioShare: "43.8%",
      updated: "12 mins ago",
      exposure: "Growth-heavy with active protocol rewards",
    },
    {
      name: "Yield Vault",
      role: "Yield",
      chain: "Base",
      status: "Synced",
      value: "$11,860",
      yield: "$71.18",
      portfolioShare: "28.2%",
      updated: "12 mins ago",
      exposure: "Primary yield concentration across protocol positions",
    },
    {
      name: "Qubic Wallet",
      role: "External",
      chain: "Qubic",
      status: "Monitoring",
      value: "$1,002",
      yield: "Awaiting next epoch",
      portfolioShare: "2.4%",
      updated: "18 mins ago",
      exposure: "Dividend-style asset tracking and balance monitoring",
    },
  ];

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
              Operational inspection for on-chain wallets, balances, protocol exposure,
              yield positions, chain distribution, and sync visibility across the
              blockchain side of Porta.
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
            $31,282
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
            $167.60
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
            3
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
            3
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

      <section className="space-y-4">
        {accountCards.map((account) => (
          <div
            key={account.name}
            className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-[#2A1D3B] dark:bg-[#100A19]"
          >
            <div className="flex flex-col gap-5 desktop:flex-row desktop:items-start desktop:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                    {account.name}
                  </h2>

                  <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]">
                    {account.role}
                  </span>

                  <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-medium text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]">
                    {account.chain}
                  </span>

                  <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-medium text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]">
                    {account.status}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                  {account.exposure}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-4 tablet:grid-cols-4">
                  <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Total Value
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      {account.value}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Yield Contribution
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      {account.yield}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                      % of Portfolio
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      {account.portfolioShare}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                      Last Updated
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      {account.updated}
                    </p>
                  </div>
                </div>
              </div>

              <div className="desktop:w-[320px]">
                <div className="rounded-2xl border border-dashed border-[#D9C7FF] bg-[#FCFAFF] p-4 dark:border-[#3A2559] dark:bg-[#140D20]">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    MMII Exposure
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                        <span>Growth</span>
                        <span>68%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#EFE7FF] dark:bg-[#221433]">
                        <div className="h-2 w-[68%] rounded-full bg-[#7C3AED]" />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                        <span>Rotational</span>
                        <span>22%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#EFE7FF] dark:bg-[#221433]">
                        <div className="h-2 w-[22%] rounded-full bg-[#A855F7]" />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                        <span>Stable</span>
                        <span>10%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#EFE7FF] dark:bg-[#221433]">
                        <div className="h-2 w-[10%] rounded-full bg-[#C084FC]" />
                      </div>
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
                    Holdings table, protocol exposure, chain breakdown, and yield rows
                    will expand here in the next build step.
                  </p>
                </div>

                <button className="rounded-xl border border-[#D9C7FF] bg-white px-4 py-2 text-sm font-medium text-[#6D28D9] transition-colors hover:bg-[#F3E8FF] dark:border-[#3A2559] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}