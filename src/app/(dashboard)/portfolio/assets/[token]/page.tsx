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
        <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
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

function TogglePill({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[#7C3AED] text-white shadow-sm"
          : "border border-[#E9DAFF] bg-white text-[#6D28D9] hover:bg-[#F3E8FF] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
      }`}
    >
      {label}
    </button>
  );
}

function ShellInput({
  label,
  value,
  placeholder,
}: {
  label: string;
  value?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <input
        value={value ?? ""}
        placeholder={placeholder}
        readOnly
        className="w-full rounded-xl border border-[#E9DAFF] bg-white px-4 py-3 text-sm text-[#2D1B45] outline-none dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF]"
      />
    </label>
  );
}

function ShellTextArea({
  label,
  value,
  placeholder,
  rows = 4,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <textarea
        value={value ?? ""}
        placeholder={placeholder}
        readOnly
        rows={rows}
        className="w-full rounded-xl border border-[#E9DAFF] bg-white px-4 py-3 text-sm leading-6 text-[#2D1B45] outline-none dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF]"
      />
    </label>
  );
}

function ShellSelect({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label className="block">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <div className="rounded-xl border border-[#E9DAFF] bg-white px-4 py-3 text-sm text-[#2D1B45] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#F3E8FF]">
        {value}
      </div>
    </label>
  );
}

function ActivityItem({
  title,
  meta,
  value,
  badge,
}: {
  title: string;
  meta: string;
  value: string;
  badge?: "info" | "good" | "warn" | "default";
}) {
  return (
    <div className="rounded-2xl border border-[#EEE4FF] bg-[#FCFAFF] p-4 dark:border-[#2A1D3B] dark:bg-[#140D20]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {title}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {meta}
          </p>
        </div>
        {badge ? <Badge variant={badge}>{value}</Badge> : null}
      </div>
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

  const mockActivities = [
    {
      title: "Threshold review scheduled",
      meta: "Porta placeholder event • Today at 10:30 AM",
      value: "Watch",
      badge: "info" as const,
    },
    {
      title: "Signal state unchanged",
      meta: "Indicator shell state • Today at 9:00 AM",
      value: "Neutral",
      badge: "default" as const,
    },
    {
      title: "Position sync placeholder",
      meta: "Holdings data layer pending • Yesterday",
      value: "Pending",
      badge: "warn" as const,
    },
    {
      title: "Asset profile scaffolded",
      meta: "Phase 1 shell created",
      value: "Ready",
      badge: "good" as const,
    },
  ];

  const mockNotes = [
    "Initial thesis shell created for future bull/bear case tracking.",
    "Threshold panel reserved for price, RSI, MACD, and take-profit configuration.",
    "This asset page will later drive Telegram Porta alerts and insights.",
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
              <Badge>Phase 1.5 Shell</Badge>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
              Dedicated asset intelligence page for charting, holdings context,
              thesis tracking, thresholds, alerts, and future Telegram Porta
              automation. This version upgrades the shell into a more interactive
              prototype so we can refine the workflow before deeper data wiring.
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
              <InsightRow label="Profile Status" value="Interactive Shell" />
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
            description="Primary chart zone for TradingView or Dexscreener embeds. This section now includes front-end shell controls so we can test the UX before live chart/data integration."
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-4 laptop:flex-row laptop:items-center laptop:justify-between">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Chart Source
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <TogglePill label="TradingView" active />
                    <TogglePill label="Dexscreener" />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Chart Timeframe
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <TogglePill label="1H" />
                    <TogglePill label="4H" active />
                    <TogglePill label="1D" />
                    <TogglePill label="1W" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-[#D9C5FF] bg-[#FCFAFF] p-6 dark:border-[#3A2952] dark:bg-[#140D20] min-h-[420px]">
                <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                  Chart Embed Zone
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                  Reserved space for TradingView or Dexscreener depending on the
                  asset type. This is where chart source switching, timeframe
                  controls, indicator overlays, and embedded chart rendering will
                  live.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 laptop:grid-cols-4">
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
                <StatCard
                  label="Signal Bias"
                  value="Neutral"
                  sublabel="Porta interpretation placeholder."
                  emphasis
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

            <div className="mt-5 grid grid-cols-1 gap-3">
              <ShellSelect label="MMII Bucket Selector" value="Growth" />
              <ShellSelect label="Role Selector" value="Tracked Asset" />
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
              <ShellSelect label="Time Horizon" value="Mid-Term" />
              <ShellSelect label="Conviction" value="Medium" />
              <ShellSelect label="Risk Rating" value="6 / 10" />
              <ShellSelect label="Target State" value="Monitoring" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <ShellTextArea
                label="Thesis Summary"
                value="This asset thesis shell will later store the why behind the position, the core bull case, the bear case, and the key reasons to continue holding or change posture."
                rows={5}
              />
              <ShellTextArea
                label="Targets + Invalidation"
                value="Future location for market cap objectives, price targets, take-profit zones, re-entry ranges, and invalidation conditions."
                rows={5}
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
              <ShellInput
                label="Price Alert"
                value="$0.0000"
                placeholder="Set price threshold"
              />
              <ShellInput
                label="Take Profit 1"
                value="$0.0000"
                placeholder="Set TP1"
              />
              <ShellInput
                label="Take Profit 2"
                value="$0.0000"
                placeholder="Set TP2"
              />
              <ShellInput
                label="Take Profit 3"
                value="$0.0000"
                placeholder="Set TP3"
              />
              <ShellInput
                label="RSI Threshold"
                value="70 / 30"
                placeholder="Set RSI watch"
              />
              <ShellInput
                label="MACD Watch"
                value="Pending"
                placeholder="Set MACD threshold"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <TogglePill label="Alerts Enabled" active />
              <TogglePill label="Porta Assist" />
              <TogglePill label="Telegram Sync" />
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

            <div className="mt-5 flex flex-wrap gap-2">
              <TogglePill label="Neutral" active />
              <TogglePill label="Accumulation" />
              <TogglePill label="Caution" />
              <TogglePill label="Exit Watch" />
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
            <div className="grid grid-cols-1 gap-3">
              {mockActivities.map((item) => (
                <ActivityItem
                  key={`${item.title}-${item.meta}`}
                  title={item.title}
                  meta={item.meta}
                  value={item.value}
                  badge={item.badge}
                />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="desktop:col-span-5">
          <SectionCard
            eyebrow="Notes Layer"
            title="Porta Notes / Asset Journal"
            description="User notes and Porta-generated observations can live here so each asset page develops its own long-term memory and planning context."
          >
            <div className="space-y-3">
              {mockNotes.map((note, index) => (
                <div
                  key={`${note}-${index}`}
                  className="rounded-2xl border border-[#EEE4FF] bg-[#FCFAFF] p-4 dark:border-[#2A1D3B] dark:bg-[#140D20]"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Porta Note {index + 1}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#2D1B45] dark:text-[#F3E8FF]">
                    {note}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}