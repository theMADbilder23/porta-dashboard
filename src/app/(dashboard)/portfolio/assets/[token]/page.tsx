type AssetViewerPageProps = {
  params: Promise<{
    token: string;
  }>;
};

function decodeToken(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseAssetRoute(token: string) {
  const [network = "unknown", symbol = token] = token.split(":");
  return {
    raw: token,
    network,
    symbol,
  };
}

function formatCategoryLabel(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatCard({
  label,
  value,
  sublabel,
  emphasis = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#E9DAFF] bg-white p-5 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold ${
          emphasis
            ? "text-[#6D28D9] dark:text-[#D8B4FE]"
            : "text-[#2D1B45] dark:text-[#F3E8FF]"
        }`}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-2 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8B5CF6] dark:text-[#C084FC]">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="mt-2 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {title}
      </h2>

      {description ? (
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
          {description}
        </p>
      ) : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "good" | "warn" | "info";
}) {
  const styles = {
    default:
      "border-[#E9DAFF] bg-[#F8F4FF] text-[#6D28D9] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#D8B4FE]",
    good: "border-[#D9F7E8] bg-[#F3FFF8] text-[#15803D] dark:border-[#1E3A2B] dark:bg-[#0F1A14] dark:text-[#86EFAC]",
    warn: "border-[#FBE7C6] bg-[#FFF8ED] text-[#B45309] dark:border-[#3A2A14] dark:bg-[#1A140D] dark:text-[#FCD34D]",
    info: "border-[#DDEBFF] bg-[#F5F9FF] text-[#2563EB] dark:border-[#1D2B47] dark:bg-[#101827] dark:text-[#93C5FD]",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function InsightRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F4ECFF] py-3 last:border-b-0 dark:border-[#1D1529]">
      <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">{label}</p>
      <p className="text-right text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
        {value}
      </p>
    </div>
  );
}

function PlaceholderPanel({
  title,
  description,
  minHeight = "min-h-[220px]",
}: {
  title: string;
  description: string;
  minHeight?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-[#D9C5FF] bg-[#FCFAFF] p-6 dark:border-[#3A2952] dark:bg-[#140D20] ${minHeight}`}
    >
      <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {title}
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
        {description}
      </p>
    </div>
  );
}

export default async function AssetViewerPage({
  params,
}: AssetViewerPageProps) {
  const { token: rawToken } = await params;
  const token = decodeToken(rawToken);
  const asset = parseAssetRoute(token);

  const categoryTags = [
    "growth",
    "yield-tracked",
    "defi",
    "threshold-ready",
  ];

  return (
    <div className="min-h-screen space-y-6 p-6">
      <section className="rounded-2xl border border-[#E9DAFF] bg-gradient-to-br from-white to-[#F8F4FF] p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="flex flex-col gap-6 desktop:flex-row desktop:items-start desktop:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6] dark:text-[#C084FC]">
              Portfolio / Assets
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                {asset.symbol} Asset Viewer
              </h1>
              <Badge variant="info">{asset.network}</Badge>
              <Badge>Phase 1 Shell</Badge>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
              Dedicated asset intelligence page for charting, holdings context,
              thesis tracking, thresholds, alerts, and future Telegram Porta
              automation. This V1 shell establishes the front-end structure so
              we can layer in live data and intelligence cleanly over time.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {categoryTags.map((tag) => (
                <Badge key={tag}>{formatCategoryLabel(tag)}</Badge>
              ))}
            </div>
          </div>

          <div className="min-w-[280px] rounded-2xl bg-[#FAF7FF] p-4 dark:bg-[#140D20]">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
              Asset Route Param
            </p>
            <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
              {token}
            </p>
            <div className="mt-4 space-y-2">
              <InsightRow label="Network" value={asset.network} />
              <InsightRow label="Asset Symbol" value={asset.symbol} />
              <InsightRow label="Profile Status" value="Scaffolded" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
        <StatCard
          label="Asset Price"
          value="$0.0000"
          sublabel="Live market pricing will be wired in during data phase."
        />
        <StatCard
          label="24H Move"
          value="+0.00%"
          sublabel="Price fluctuation metrics placeholder."
        />
        <StatCard
          label="Market Cap"
          value="$0.00"
          sublabel="Can later be sourced from CoinMarketCap / DefiLlama."
        />
        <StatCard
          label="Porta Signal State"
          value="Neutral"
          sublabel="Future AI interpretation of chart + thresholds."
          emphasis
        />
      </section>

      <section className="grid grid-cols-1 gap-6 desktop:grid-cols-12">
        <div className="desktop:col-span-8">
          <SectionCard
            eyebrow="Chart / Signal Layer"
            title="Chart + Indicator Intelligence"
            description="Primary chart zone for TradingView or Dexscreener embeds. This section will later support indicator tracking, chart-source selection, and Porta signal interpretation."
          >
            <div className="grid grid-cols-1 gap-4">
              <PlaceholderPanel
                title="Chart Embed Zone"
                description="Reserved space for TradingView or Dexscreener depending on the asset type. This is where chart source switching, timeframe controls, and embedded chart rendering will live."
                minHeight="min-h-[420px]"
              />

              <div className="grid grid-cols-1 gap-4 laptop:grid-cols-3">
                <StatCard
                  label="RSI"
                  value="—"
                  sublabel="Tracked indicator placeholder."
                />
                <StatCard
                  label="Stoch RSI"
                  value="—"
                  sublabel="Tracked indicator placeholder."
                />
                <StatCard
                  label="MACD"
                  value="—"
                  sublabel="Tracked indicator placeholder."
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="desktop:col-span-4">
          <SectionCard
            eyebrow="Position Snapshot"
            title="My Position"
            description="Core user-specific holdings intelligence for this asset."
          >
            <div className="space-y-3">
              <InsightRow label="Total Holdings" value="0.00 units" />
              <InsightRow label="Holdings Value" value="$0.00" />
              <InsightRow label="Average Entry" value="$0.00" />
              <InsightRow label="Unrealized P/L" value="$0.00 (0.00%)" />
              <InsightRow label="Portfolio Allocation" value="0.00%" />
              <InsightRow label="MMII Bucket" value="Growth" />
              <InsightRow label="Role" value="Tracked Asset" />
              <InsightRow label="Held Since" value="—" />
            </div>
          </SectionCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 desktop:grid-cols-12">
        <div className="desktop:col-span-6">
          <SectionCard
            eyebrow="Strategy Layer"
            title="Thesis / Strategy Profile"
            description="This section captures why the asset is held, what the plan is, and which targets or invalidation points matter most."
          >
            <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2">
              <StatCard
                label="Time Horizon"
                value="Mid-Term"
                sublabel="User-editable later."
              />
              <StatCard
                label="Conviction"
                value="Medium"
                sublabel="Can later be driven by Porta + user review."
              />
              <StatCard
                label="Risk Rating"
                value="6 / 10"
                sublabel="Future intelligence score."
              />
              <StatCard
                label="Target State"
                value="Monitoring"
                sublabel="Tracks whether asset is in entry/hold/exit watch."
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <PlaceholderPanel
                title="Thesis Summary"
                description="Space for the asset thesis, bull case, bear case, and why this asset belongs in the portfolio."
                minHeight="min-h-[150px]"
              />
              <PlaceholderPanel
                title="Targets + Invalidation"
                description="Future location for market cap objectives, price targets, take-profit zones, re-entry ranges, and invalidation conditions."
                minHeight="min-h-[150px]"
              />
            </div>
          </SectionCard>
        </div>

        <div className="desktop:col-span-6">
          <SectionCard
            eyebrow="Thresholds / Alerts"
            title="Threshold Command Panel"
            description="User-defined and Porta-assisted thresholds will live here. These settings will later drive Telegram alerts, signal watchlists, and automated insights."
          >
            <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2">
              <StatCard
                label="Price Thresholds"
                value="Pending"
                sublabel="Entry / exit / caution levels."
              />
              <StatCard
                label="Indicator Thresholds"
                value="Pending"
                sublabel="RSI / Stoch RSI / MACD levels."
              />
              <StatCard
                label="Take-Profit Zones"
                value="Pending"
                sublabel="User + Porta-defined objectives."
              />
              <StatCard
                label="Alert Status"
                value="Inactive"
                sublabel="Telegram trigger wiring comes later."
              />
            </div>

            <div className="mt-5">
              <PlaceholderPanel
                title="Threshold Editor Shell"
                description="This area will later become the main threshold configuration interface for prices, indicators, objectives, alert severity, and AI-assisted recommendations."
                minHeight="min-h-[170px]"
              />
            </div>
          </SectionCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 desktop:grid-cols-12">
        <div className="desktop:col-span-7">
          <SectionCard
            eyebrow="Market / Protocol Context"
            title="Asset Intelligence Snapshot"
            description="High-level market and protocol data points specific to the asset. Later this can combine external data with user-specific context."
          >
            <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-3">
              <StatCard
                label="Volume"
                value="$0.00"
                sublabel="Market activity placeholder."
              />
              <StatCard
                label="Liquidity"
                value="$0.00"
                sublabel="Useful for Dex assets and execution risk."
              />
              <StatCard
                label="FDV"
                value="$0.00"
                sublabel="Future fully diluted valuation metric."
              />
              <StatCard
                label="Supply State"
                value="—"
                sublabel="Circulating / max supply placeholder."
              />
              <StatCard
                label="Yield Status"
                value="Unknown"
                sublabel="Will later show staking/lending state."
              />
              <StatCard
                label="Risk Context"
                value="Pending"
                sublabel="Protocol / market condition summary."
              />
            </div>
          </SectionCard>
        </div>

        <div className="desktop:col-span-5">
          <SectionCard
            eyebrow="Porta State"
            title="Porta Intelligence State"
            description="This is where Porta’s asset-specific interpretation will eventually live."
          >
            <div className="space-y-3">
              <InsightRow label="Signal State" value="Neutral" />
              <InsightRow label="Alert Priority" value="Normal" />
              <InsightRow label="Asset Health" value="Awaiting data" />
              <InsightRow label="Sizing Status" value="Not assessed" />
              <InsightRow label="Action Bias" value="Observe" />
            </div>

            <div className="mt-5">
              <PlaceholderPanel
                title="Porta Insight Feed"
                description="Future AI insights will summarize what matters most for this asset right now: momentum state, caution factors, positioning notes, and threshold relevance."
                minHeight="min-h-[150px]"
              />
            </div>
          </SectionCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 desktop:grid-cols-12">
        <div className="desktop:col-span-7">
          <SectionCard
            eyebrow="Activity Layer"
            title="Transactions / Activity"
            description="This section will eventually show wallet actions, position changes, claims, staking updates, and other asset-specific activity."
          >
            <PlaceholderPanel
              title="Activity Feed Placeholder"
              description="Reserved for transaction history, wallet movements, claims, stakes, unstakes, and other asset events once position-level data plumbing is completed."
              minHeight="min-h-[240px]"
            />
          </SectionCard>
        </div>

        <div className="desktop:col-span-5">
          <SectionCard
            eyebrow="Notes Layer"
            title="Porta Notes / Asset Journal"
            description="User notes and Porta-generated observations can live here so each asset page develops its own long-term memory and planning context."
          >
            <PlaceholderPanel
              title="Notes + Review Journal"
              description="Reserved for thesis notes, reminders, change logs, chat-derived summaries, and future AI-generated asset reviews."
              minHeight="min-h-[240px]"
            />
          </SectionCard>
        </div>
      </section>
    </div>
  );
}