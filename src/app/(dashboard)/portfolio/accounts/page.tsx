import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Banknote,
  Building2,
  Landmark,
  Search,
  Shield,
  Wallet,
} from "lucide-react";

type BlockchainAccountsSummary = {
  total_blockchain_value?: number;
  yield_contribution?: number;
  active_accounts?: number;
  chains_covered?: number;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

async function getBlockchainSummary(): Promise<BlockchainAccountsSummary | null> {
  try {
    const headerStore = await headers();
    const host = headerStore.get("host");
    const proto =
      headerStore.get("x-forwarded-proto") ||
      (host?.includes("localhost") ? "http" : "https");

    if (!host) return null;

    const response = await fetch(
      `${proto}://${host}/api/blockchain-accounts-summary`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] px-4 py-3 dark:border-[#241733] dark:bg-[#120D1B]">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[#8E7AAE] dark:text-[#9F89BA]">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {value}
      </div>
    </div>
  );
}

type AccountOverviewCardProps = {
  title: string;
  href: string;
  description: string;
  icon: React.ReactNode;
  totalValue: string;
  yieldContribution: string;
  accountCount: string;
  extraMetricLabel: string;
  extraMetricValue: string;
  mmiiExposure: string;
  syncStatus: string;
  lastUpdate: string;
  accentLabel: string;
  isLive?: boolean;
};

function AccountOverviewCard({
  title,
  href,
  description,
  icon,
  totalValue,
  yieldContribution,
  accountCount,
  extraMetricLabel,
  extraMetricValue,
  mmiiExposure,
  syncStatus,
  lastUpdate,
  accentLabel,
  isLive = false,
}: AccountOverviewCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-[#E9DAFF] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D5BAFF] hover:shadow-[0_16px_40px_rgba(122,63,255,0.08)] dark:border-[#2A1D3B] dark:bg-[#100A19] dark:hover:border-[#4A2A73] dark:hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E9DAFF] bg-[#F7F1FF] text-[#7A3FFF] dark:border-[#312046] dark:bg-[#161022] dark:text-[#CDAEFF]">
            {icon}
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                {title}
              </h2>

              <span className="rounded-full border border-[#E9DAFF] bg-[#FAF7FF] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7A3FFF] dark:border-[#312046] dark:bg-[#140F1F] dark:text-[#CDAEFF]">
                {accentLabel}
              </span>

              {isLive ? (
                <span className="rounded-full border border-[#DDF5E8] bg-[#F3FCF7] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#198754] dark:border-[#234735] dark:bg-[#0F1A14] dark:text-[#7DDBA3]">
                  Live
                </span>
              ) : null}
            </div>

            <p className="max-w-[32rem] text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9D5]">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-[#7A3FFF] dark:text-[#CDAEFF]">
          <span className="hidden sm:inline">Open</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <MetricPill label="Total Value" value={totalValue} />
        <MetricPill label="Yield Contribution" value={yieldContribution} />
        <MetricPill label="Accounts / Wallets" value={accountCount} />
        <MetricPill label={extraMetricLabel} value={extraMetricValue} />
        <MetricPill label="MMII Exposure" value={mmiiExposure} />
        <MetricPill label="Sync Status" value={syncStatus} />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] px-4 py-3 dark:border-[#241733] dark:bg-[#120D1B]">
        <div className="text-xs uppercase tracking-[0.14em] text-[#8E7AAE] dark:text-[#9F89BA]">
          Last Update
        </div>
        <div className="text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
          {lastUpdate}
        </div>
      </div>
    </Link>
  );
}

function QuickAction({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-4 dark:border-[#241733] dark:bg-[#120D1B]">
      <div className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {title}
      </div>
      <div className="mt-1 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9D5]">
        {description}
      </div>
    </div>
  );
}

export default async function AccountsPage() {
  const blockchainSummary = await getBlockchainSummary();

  const blockchainValue = blockchainSummary?.total_blockchain_value ?? 0;
  const blockchainYield = blockchainSummary?.yield_contribution ?? 0;
  const blockchainAccounts = blockchainSummary?.active_accounts ?? 0;
  const blockchainChains = blockchainSummary?.chains_covered ?? 0;

  return (
    <div className="p-6">
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E9DAFF] bg-[#FAF7FF] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A3FFF] dark:border-[#312046] dark:bg-[#140F1F] dark:text-[#CDAEFF]">
                <Shield className="h-3.5 w-3.5" />
                Operational Inspection Layer
              </div>

              <h1 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Accounts
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6B5A86] dark:text-[#BFA9D5]">
                Inspect Blockchain, Investment, and Banking accounts from one
                operational layer. This page acts as a navigation and command
                surface before drilling into each dedicated account module.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[32rem]">
              <MetricPill label="Sections" value="3" />
              <MetricPill
                label="Live Blockchain Value"
                value={formatCompactUsd(blockchainValue)}
              />
              <MetricPill
                label="Live Yield"
                value={formatCompactUsd(blockchainYield)}
              />
              <MetricPill label="Mode" value="Inspection" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <AccountOverviewCard
            title="Blockchain Accounts"
            href="/portfolio/accounts/blockchain"
            description="Inspect live on-chain wallets, protocol positions, yield sources, and chain distribution using the current blockchain accounts summary layer."
            icon={<Wallet className="h-5 w-5" />}
            totalValue={formatUsd(blockchainValue)}
            yieldContribution={formatUsd(blockchainYield)}
            accountCount={String(blockchainAccounts)}
            extraMetricLabel="Chains Covered"
            extraMetricValue={String(blockchainChains)}
            mmiiExposure="Stable / Growth / Swing"
            syncStatus={
              blockchainSummary ? "Connected" : "Unavailable"
            }
            lastUpdate={blockchainSummary ? "Live summary loaded" : "Summary unavailable"}
            accentLabel="Live First"
            isLive={Boolean(blockchainSummary)}
          />

          <AccountOverviewCard
            title="Investment Accounts"
            href="/portfolio/accounts/investments"
            description="Future home for Wealthsimple, IBKR, and other brokerage layers covering equities, ETFs, dividend tracking, and rotational macro sleeves."
            icon={<Building2 className="h-5 w-5" />}
            totalValue="$—"
            yieldContribution="$—"
            accountCount="Planned"
            extraMetricLabel="% of Portfolio"
            extraMetricValue="—"
            mmiiExposure="Rotational Core"
            syncStatus="Stubbed"
            lastUpdate="Pending collector expansion"
            accentLabel="Next"
          />

          <AccountOverviewCard
            title="Banking Accounts"
            href="/portfolio/accounts/banking"
            description="Future cash-flow and reserve layer for fiat balances, 40/60 routing visibility, growth vault tracking, and budgeting-system integration."
            icon={<Landmark className="h-5 w-5" />}
            totalValue="$—"
            yieldContribution="$—"
            accountCount="Planned"
            extraMetricLabel="% of Portfolio"
            extraMetricValue="—"
            mmiiExposure="Cash / Reserve"
            syncStatus="Stubbed"
            lastUpdate="Pending manual + API support"
            accentLabel="Future"
          />
        </section>

        <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 dark:border-[#2A1D3B] dark:bg-[#100A19]">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E9DAFF] bg-[#FAF7FF] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7A3FFF] dark:border-[#312046] dark:bg-[#140F1F] dark:text-[#CDAEFF]">
                <Search className="h-3.5 w-3.5" />
                Asset Viewer Quick Access
              </div>

              <h2 className="text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Jump directly into any tracked asset
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6B5A86] dark:text-[#BFA9D5]">
                This panel should mirror the Asset Viewer search UX so users can
                quickly find any portfolio asset and route straight into its
                dedicated viewer page.
              </p>

              <div className="mt-5 rounded-2xl border border-[#F0E7FF] bg-[#FCFAFF] p-3 dark:border-[#241733] dark:bg-[#120D1B]">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E7AAE] dark:text-[#9F89BA]" />
                    <input
                      type="text"
                      placeholder="Search portfolio assets..."
                      className="h-12 w-full rounded-xl border border-[#E9DAFF] bg-white pl-11 pr-4 text-sm text-[#2D1B45] outline-none transition placeholder:text-[#9A88B6] focus:border-[#CDAEFF] dark:border-[#2C1C3F] dark:bg-[#0E0916] dark:text-[#F3E8FF] dark:placeholder:text-[#8F7AA7] dark:focus:border-[#5C3692]"
                    />
                  </div>

                  <Link
                    href="/portfolio/assets"
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-[#7A3FFF] px-5 text-sm font-medium text-white transition hover:bg-[#6B33EB]"
                  >
                    Open Asset Viewer
                  </Link>
                </div>

                <div className="mt-3 text-xs text-[#8E7AAE] dark:text-[#9F89BA]">
                  Planned behavior: identical search dropdown UX as the Asset
                  Viewer hero panel, with direct routing into the selected asset
                  page.
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <QuickAction
                title="Blockchain inspection"
                description="Live wallets, protocol exposure, yield positions, active accounts, and chain-level visibility."
              />
              <QuickAction
                title="Investment inspection"
                description="Brokerage accounts, equities, ETFs, dividend income, and rotational-core visibility."
              />
              <QuickAction
                title="Banking inspection"
                description="Cash balances, reserve flow, future budget routing, and fiat execution visibility."
              />
              <div className="rounded-2xl border border-dashed border-[#DCC9FF] bg-[#FAF7FF] p-4 dark:border-[#3A2654] dark:bg-[#140F1F]">
                <div className="flex items-start gap-3">
                  <Banknote className="mt-0.5 h-5 w-5 text-[#7A3FFF] dark:text-[#CDAEFF]" />
                  <div>
                    <div className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      Build order
                    </div>
                    <div className="mt-1 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9D5]">
                      Blockchain is now wired to the live summary endpoint.
                      Investment and Banking stay cleanly stubbed until their
                      collectors and account APIs are ready.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}