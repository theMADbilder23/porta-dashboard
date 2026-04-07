import { headers } from "next/headers";
import AssetChartEmbed from "@/components/asset-chart-embed";
import AssetRouteSwitcher from "@/components/asset-route-switcher";
import QcapCustomChart from "@/components/qcap-custom-chart";
import { resolveChartConfig } from "@/lib/chart-resolver";

type AssetViewerPageProps = {
  params: Promise<{
    token: string;
  }>;
};

type AssetViewerResponse = {
  found: boolean;
  asset: {
    route_param: string;
    asset_id: string;
    token_symbol: string;
    token_name: string;
    network: string;
    asset_class: string;
    protocol: string | null;
    category_tags: string[];
    yield_profile: string;
    mmii_bucket: string;
    mmii_subclass: string | null;
    position_role: string;
    is_yield_position: boolean;
  };
  market: {
    price_per_unit_usd: number;
    price_source: string | null;
    change_24h_percent: number | null;
    change_7d_percent: number | null;
    market_cap_usd: number | null;
    fdv_usd: number | null;
    volume_24h_usd: number | null;
    liquidity_usd: number | null;
  };
  position: {
    total_amount: number;
    total_value_usd: number;
    principal_amount: number;
    principal_value_usd: number;
    reward_amount: number;
    reward_value_usd: number;
    yield_position_value_usd: number;
    non_yield_position_value_usd: number;
    wallet_count: number;
    wallet_breakdown: Array<{
      wallet_id: string;
      wallet_name: string;
      wallet_address: string | null;
      network_group: string | null;
      role: string | null;
      total_amount: number;
      total_value_usd: number;
      principal_value_usd: number;
      reward_value_usd: number;
      latest_snapshot_time: string | null;
      row_count: number;
    }>;
  };
  latest_snapshot: {
    snapshot_time: string | null;
  };
  debug?: {
    matched_rows?: number;
    matched_wallets?: number;
    resolver?: string;
  };
  error?: string;
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
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: unknown, digits = 2) {
  return `$${safeNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatCompactCurrency(value: unknown) {
  const safeValue = safeNumber(value);
  const abs = Math.abs(safeValue);

  if (abs >= 1_000_000_000) {
    return `$${(safeValue / 1_000_000_000).toFixed(2)}B`;
  }

  if (abs >= 1_000_000) {
    return `$${(safeValue / 1_000_000).toFixed(2)}M`;
  }

  if (abs >= 1_000) {
    return `$${(safeValue / 1_000).toFixed(2)}K`;
  }

  return formatCurrency(safeValue);
}

function formatPercent(value: number | null, digits = 2) {
  if (value === null || value === undefined) return "—";
  return `${safeNumber(value).toFixed(digits)}%`;
}

function formatTokenAmount(value: unknown) {
  const safeValue = safeNumber(value);

  return safeValue.toLocaleString(undefined, {
    minimumFractionDigits: safeValue >= 1000 ? 0 : 2,
    maximumFractionDigits: 4,
  });
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function CompactSignalCard({
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
    <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
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
    good:
      "border-[#D9F7E8] bg-[#F3FFF8] text-[#15803D] dark:border-[#1E3A2B] dark:bg-[#0F1A14] dark:text-[#86EFAC]",
    warn:
      "border-[#FBE7C6] bg-[#FFF8ED] text-[#B45309] dark:border-[#3A2A14] dark:bg-[#1A140D] dark:text-[#FCD34D]",
    info:
      "border-[#DDEBFF] bg-[#F5F9FF] text-[#2563EB] dark:border-[#1D2B47] dark:bg-[#101827] dark:text-[#93C5FD]",
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

function PositionStripMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EEE4FF] bg-[#FCFAFF] px-4 py-4 dark:border-[#2A1D3B] dark:bg-[#140D20]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
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

async function fetchAssetViewerData(
  token: string
): Promise<AssetViewerResponse | null> {
  const headerStore = await headers();
  const host = headerStore.get("host");

  if (!host) {
    return null;
  }

  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  try {
    const response = await fetch(
      `${baseUrl}/api/asset-viewer?asset=${encodeURIComponent(token)}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AssetViewerResponse;
  } catch {
    return null;
  }
}

export default async function AssetViewerPage({
  params,
}: AssetViewerPageProps) {
  const { token: rawToken } = await params;
  const token = decodeToken(rawToken);
  const routeAsset = parseAssetRoute(token);

  const data = await fetchAssetViewerData(token);

  const asset = data?.asset || {
    route_param: token,
    asset_id: token,
    token_symbol: routeAsset.symbol,
    token_name: routeAsset.symbol,
    network: routeAsset.network,
    asset_class: "crypto",
    protocol: null,
    category_tags: [],
    yield_profile: "none",
    mmii_bucket: "growth",
    mmii_subclass: null,
    position_role: "principal",
    is_yield_position: false,
  };

  const market = data?.market || {
    price_per_unit_usd: 0,
    price_source: null,
    change_24h_percent: null,
    change_7d_percent: null,
    market_cap_usd: null,
    fdv_usd: null,
    volume_24h_usd: null,
    liquidity_usd: null,
  };

  const position = data?.position || {
    total_amount: 0,
    total_value_usd: 0,
    principal_amount: 0,
    principal_value_usd: 0,
    reward_amount: 0,
    reward_value_usd: 0,
    yield_position_value_usd: 0,
    non_yield_position_value_usd: 0,
    wallet_count: 0,
    wallet_breakdown: [],
  };

  const latestSnapshotTime = data?.latest_snapshot?.snapshot_time || null;

  const categoryTags =
    asset.category_tags && asset.category_tags.length > 0
      ? asset.category_tags
      : ["threshold-ready"];

  const mockActivities = [
    {
      title: data?.found ? "Asset data resolved" : "Asset lookup pending",
      meta: data?.found
        ? `Latest snapshot • ${formatDateTimeLabel(latestSnapshotTime)}`
        : "No live asset rows matched yet",
      value: data?.found ? "Live" : "Pending",
      badge: data?.found ? ("good" as const) : ("warn" as const),
    },
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
      title: "Asset profile scaffolded",
      meta: data?.found ? "Phase 2A header + position live" : "Phase 2A shell ready",
      value: "Ready",
      badge: "good" as const,
    },
  ];

  const mockNotes = [
    "Header and position snapshot are now wired to live wallet_holdings data.",
    "Chart, thresholds, and thesis sections remain front-end shell panels for the next phases.",
    "Wallet breakdown and role/bucket identity are now being resolved from the asset-viewer API.",
  ];

  const liveRoleLabel =
    asset.position_role === "mixed"
      ? "Principal + Reward"
      : formatCategoryLabel(asset.position_role);

  const yieldStatusLabel =
    asset.yield_profile && asset.yield_profile !== "none"
      ? formatCategoryLabel(asset.yield_profile)
      : asset.is_yield_position
        ? "Yield Tracked"
        : "None";

  const chartConfig = resolveChartConfig({
    network: asset.network,
    tokenSymbol: asset.token_symbol,
    assetId: asset.asset_id,
  });

  const isQcap = asset.token_symbol.toUpperCase() === "QCAP";

  return (
    <div className="min-h-screen space-y-6 p-6">
      <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
        <div className="grid grid-cols-1 gap-6 desktop:grid-cols-12">
          <div className="desktop:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6] dark:text-[#C084FC]">
              Portfolio / Assets
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                {asset.token_symbol} Asset Viewer
              </h1>
              <Badge variant="info">{asset.network}</Badge>
              <Badge>{data?.found ? "Phase 2A Live" : "Phase 2A Shell"}</Badge>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
              Dedicated asset intelligence page for charting, holdings context,
              thesis tracking, thresholds, alerts, and future Telegram Porta
              automation. This version now resolves live asset identity and
              position data from the collector holdings layer while the rest of
              the intelligence shell continues to be built out.
            </p>

                        <div className="mt-4 flex flex-wrap gap-2">
              {categoryTags.map((tag) => (
                <Badge key={tag}>{formatCategoryLabel(tag)}</Badge>
              ))}
            </div>

            <div className="mt-5 max-w-2xl">
              <AssetRouteSwitcher currentRoute={asset.route_param} />
            </div>
          </div>

          <div className="desktop:col-span-4">
            <div className="rounded-2xl border border-[#EEE4FF] bg-[#FCFAFF] p-5 shadow-sm dark:border-[#312047] dark:bg-[#140D20]">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                Asset Route Param
              </p>
              <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                {token}
              </p>

              <div className="mt-4 space-y-1">
                <InsightRow label="Network" value={asset.network} />
                <InsightRow label="Asset Symbol" value={asset.token_symbol} />
                <InsightRow
                  label="Profile Status"
                  value={
                    data?.found ? "Live Header + Position" : "Shell / No Match Yet"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {!data?.found ? (
        <section className="rounded-2xl border border-[#FBE7C6] bg-[#FFF8ED] p-5 text-sm text-[#9A6700] dark:border-[#3A2A14] dark:bg-[#1A140D] dark:text-[#FCD34D]">
          No live holdings match was found for this asset route yet. The page shell
          is still available, but header and position values are falling back to
          safe defaults until matching collector rows exist.
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
        <StatCard
          label="Asset Price"
          value={formatCurrency(market.price_per_unit_usd, 4)}
          sublabel={
            market.price_source
              ? `Latest price source: ${formatCategoryLabel(market.price_source)}`
              : "Latest market price from holdings layer."
          }
        />
        <StatCard
          label="24H Move"
          value={formatPercent(market.change_24h_percent, 2)}
          sublabel="Market move feed will be added in the next data phase."
        />
        <StatCard
          label="Market Cap"
          value={
            market.market_cap_usd !== null
              ? formatCompactCurrency(market.market_cap_usd)
              : "—"
          }
          sublabel="External market-cap enrichment comes next."
        />
        <StatCard
          label="Porta Signal State"
          value="Neutral"
          sublabel="Future AI interpretation of chart + thresholds."
          emphasis
        />
      </section>

      <SectionCard
        eyebrow="Position Snapshot"
        title="My Position"
        description="Core user-specific holdings intelligence for this asset, restructured into a full-width execution strip so position context stays visible without shrinking the chart."
      >
        <div className="grid grid-cols-2 gap-4 laptop:grid-cols-4 desktop:grid-cols-8">
          <PositionStripMetric
            label="Total Holdings"
            value={`${formatTokenAmount(position.total_amount)} units`}
          />
          <PositionStripMetric
            label="Holdings Value"
            value={formatCurrency(position.total_value_usd)}
          />
          <PositionStripMetric
            label="Principal Value"
            value={formatCurrency(position.principal_value_usd)}
          />
          <PositionStripMetric
            label="Reward Value"
            value={formatCurrency(position.reward_value_usd)}
          />
          <PositionStripMetric
            label="Wallet Count"
            value={String(position.wallet_count)}
          />
          <PositionStripMetric
            label="MMII Bucket"
            value={formatCategoryLabel(asset.mmii_bucket)}
          />
          <PositionStripMetric label="Role" value={liveRoleLabel} />
          <PositionStripMetric
            label="Held Since"
            value={formatDateTimeLabel(latestSnapshotTime)}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 laptop:grid-cols-2">
          <ShellSelect
            label="MMII Bucket Selector"
            value={formatCategoryLabel(asset.mmii_bucket)}
          />
          <ShellSelect label="Role Selector" value={liveRoleLabel} />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Chart / Signal Layer"
        title="Chart + Indicator Intelligence"
        description="Primary chart zone for TradingView or Dexscreener-style intelligence. This section is now treated as the dominant page focus so the asset viewer feels more like a trading intelligence terminal than a summary dashboard."
      >
        <div className="space-y-5">
          {isQcap ? (
            <QcapCustomChart liveUsdPrice={market.price_per_unit_usd} />
          ) : (
            <AssetChartEmbed chartConfig={chartConfig} defaultTimeframe="4H" />
          )}

          {!isQcap ? (
            <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-6">
              <CompactSignalCard
                label="Signal Bias"
                value="Neutral"
                sublabel="Porta interpretation placeholder."
                emphasis
              />
              <CompactSignalCard
                label="RSI"
                value="—"
                sublabel="Tracked indicator placeholder."
              />
              <CompactSignalCard
                label="Stoch RSI"
                value="—"
                sublabel="Tracked indicator placeholder."
              />
              <CompactSignalCard
                label="MACD"
                value="—"
                sublabel="Tracked indicator placeholder."
              />
              <CompactSignalCard
                label="1H Volume"
                value="—"
                sublabel="Short-term momentum placeholder."
              />
              <CompactSignalCard
                label="24H Volume"
                value="—"
                sublabel="Daily activity placeholder."
              />
            </div>
          ) : null}
        </div>
      </SectionCard>

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
                value={formatCurrency(market.price_per_unit_usd, 4)}
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
                value={
                  market.volume_24h_usd !== null
                    ? formatCompactCurrency(market.volume_24h_usd)
                    : "—"
                }
                sublabel="Market activity enrichment comes next."
              />
              <StatCard
                label="Liquidity"
                value={
                  market.liquidity_usd !== null
                    ? formatCompactCurrency(market.liquidity_usd)
                    : "—"
                }
                sublabel="Useful for Dex assets and execution risk."
              />
              <StatCard
                label="FDV"
                value={
                  market.fdv_usd !== null
                    ? formatCompactCurrency(market.fdv_usd)
                    : "—"
                }
                sublabel="Future fully diluted valuation metric."
              />
              <StatCard
                label="Supply State"
                value="—"
                sublabel="Circulating / max supply placeholder."
              />
              <StatCard
                label="Yield Status"
                value={yieldStatusLabel}
                sublabel="Resolved from enriched holdings profile."
              />
              <StatCard
                label="Risk Context"
                value={asset.protocol ? formatCategoryLabel(asset.protocol) : "Pending"}
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
              <InsightRow
                label="Asset Health"
                value={data?.found ? "Live position resolved" : "Awaiting data"}
              />
              <InsightRow
                label="Sizing Status"
                value={position.wallet_count > 0 ? "Tracked" : "Not assessed"}
              />
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

      {position.wallet_breakdown.length > 0 ? (
        <SectionCard
          eyebrow="Wallet Distribution"
          title="Wallet Breakdown"
          description="Current per-wallet position distribution for this asset from the latest matched holdings snapshot per wallet."
        >
          <div className="overflow-x-auto rounded-2xl border border-[#E9DAFF] dark:border-[#312047]">
            <table className="min-w-full text-left">
              <thead className="bg-[#F6F0FF] dark:bg-[#140D20]">
                <tr className="border-b border-[#F0E8FF] dark:border-[#241533]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Wallet
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Role
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Total Amount
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Total Value
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Principal
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Reward
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Latest Snapshot
                  </th>
                </tr>
              </thead>

              <tbody>
                {position.wallet_breakdown.map((wallet) => (
                  <tr
                    key={wallet.wallet_id}
                    className="border-b border-[#F7F1FF] dark:border-[#1C1328]"
                  >
                    <td className="px-4 py-4 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                      {wallet.wallet_name}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                      {wallet.role ? formatCategoryLabel(wallet.role) : "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                      {formatTokenAmount(wallet.total_amount)}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-[#2D1B45] dark:text-[#F3E8FF]">
                      {formatCurrency(wallet.total_value_usd)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                      {formatCurrency(wallet.principal_value_usd)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#6D28D9] dark:text-[#D8B4FE]">
                      {formatCurrency(wallet.reward_value_usd)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#2D1B45] dark:text-[#F3E8FF]">
                      {formatDateTimeLabel(wallet.latest_snapshot_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}