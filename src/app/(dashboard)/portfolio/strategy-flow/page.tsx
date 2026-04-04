"use client";

import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

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

type AlignmentTier = {
  key: string;
  label: string;
  actual_pct: number;
  target_pct: number;
  deviation_pct: number;
  status: "aligned" | "watch" | "warning";
};

type FlowCardData = {
  title: string;
  subtitle?: string;
  value?: string;
  meta?: string;
  secondary?: string;
  tertiary?: string;
  tone?: "root" | "tier_0" | "tier_1" | "tier_2" | "bucket" | "subclass" | "wallet";
  width?: number;
  minHeight?: number;
  warning?: boolean;
  pulse?: boolean;
  emphasis?: "high" | "medium" | "low";
};

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function getTierTargets() {
  return {
    tier_0: 40,
    tier_1: 30,
    tier_2: 30,
  };
}

function getTierAlignmentStatus(deviationPct: number): AlignmentTier["status"] {
  const abs = Math.abs(deviationPct);
  if (abs >= 15) return "warning";
  if (abs >= 7) return "watch";
  return "aligned";
}

function buildAlignmentTiers(structure?: StructureNode): AlignmentTier[] {
  if (!structure) return [];

  const targets = getTierTargets();

  return (structure.children ?? []).map((tier) => {
    const targetPct =
      tier.key === "tier_0"
        ? targets.tier_0
        : tier.key === "tier_1"
          ? targets.tier_1
          : targets.tier_2;

    const actualPct = safeNumber(tier.allocation_pct);
    const deviationPct = actualPct - targetPct;

    return {
      key: tier.key,
      label: tier.label,
      actual_pct: actualPct,
      target_pct: targetPct,
      deviation_pct: deviationPct,
      status: getTierAlignmentStatus(deviationPct),
    };
  });
}

function computeAlignmentScore(alignmentTiers: AlignmentTier[]) {
  if (!alignmentTiers.length) return 0;

  const totalDeviation = alignmentTiers.reduce(
    (sum, tier) => sum + Math.abs(safeNumber(tier.deviation_pct)),
    0
  );

  return Math.max(0, Math.round(100 - totalDeviation));
}

function getAlignmentHeadline(score: number) {
  if (score >= 80) return "High MMII Alignment";
  if (score >= 55) return "Moderate MMII Alignment";
  if (score >= 35) return "Low MMII Alignment";
  return "Critical MMII Drift";
}

function getAlignmentInsight(alignmentTiers: AlignmentTier[]) {
  if (!alignmentTiers.length) {
    return "No tier alignment data available yet.";
  }

  const mostDrifted = [...alignmentTiers].sort(
    (a, b) => Math.abs(b.deviation_pct) - Math.abs(a.deviation_pct)
  )[0];

  if (!mostDrifted) {
    return "MMII structure appears neutral.";
  }

  const deviation = safeNumber(mostDrifted.deviation_pct);

  if (Math.abs(deviation) < 5) {
    return "Structure is relatively balanced against current MMII tier targets.";
  }

  if (deviation > 0) {
    return `${mostDrifted.label} is overweight by ${formatPercent(
      deviation
    )} versus current MMII targets.`;
  }

  return `${mostDrifted.label} is under-allocated by ${formatPercent(
    Math.abs(deviation)
  )} versus current MMII targets.`;
}

function getTierAlignmentMap(alignmentTiers: AlignmentTier[]) {
  return new Map(alignmentTiers.map((tier) => [tier.key, tier]));
}

function getTierTone(tierKey: string): FlowCardData["tone"] {
  if (tierKey === "tier_0") return "tier_0";
  if (tierKey === "tier_1") return "tier_1";
  return "tier_2";
}

function getTierEdgeColor(tierKey: string) {
  if (tierKey === "tier_0") return "#22C55E";
  if (tierKey === "tier_1") return "#A855F7";
  return "#3B82F6";
}

function getAlignmentStyle(status?: AlignmentTier["status"]) {
  if (status === "warning") {
    return {
      label: "Warning",
      className:
        "bg-[#FFF1F2] text-[#BE123C] dark:bg-[#2A1218] dark:text-[#FDA4AF]",
    };
  }

  if (status === "watch") {
    return {
      label: "Watch",
      className:
        "bg-[#FFF7ED] text-[#C2410C] dark:bg-[#26180F] dark:text-[#FDBA74]",
    };
  }

  return {
    label: "Aligned",
    className:
      "bg-[#ECFDF3] text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]",
  };
}

function getToneClasses(
  tone: FlowCardData["tone"],
  warning?: boolean,
  pulse?: boolean,
  emphasis?: FlowCardData["emphasis"]
) {
  const emphasisShadow =
    emphasis === "high"
      ? "shadow-[0_8px_24px_rgba(124,58,237,0.18)]"
      : emphasis === "medium"
        ? "shadow-[0_6px_18px_rgba(124,58,237,0.12)]"
        : "shadow-sm";

  const glow = warning
    ? pulse
      ? "ring-2 ring-[#FB7185]/70 shadow-[0_0_0_1px_rgba(244,63,94,0.3),0_0_26px_rgba(244,63,94,0.28)] animate-pulse"
      : "ring-2 ring-[#FB7185]/60 shadow-[0_0_0_1px_rgba(244,63,94,0.28),0_0_22px_rgba(244,63,94,0.24)]"
    : emphasisShadow;

  switch (tone) {
    case "root":
      return {
        shell: `border-[#D8B4FE] bg-gradient-to-br from-white to-[#F8F4FF] dark:border-[#4B2A6B] dark:from-[#100A19] dark:to-[#171022] ${glow}`,
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "tier_0":
      return {
        shell: `border-[#BBF7D0] bg-[#F4FFF7] dark:border-[#1E4D2B] dark:bg-[#0F1A13] ${glow}`,
        badge: "bg-[#DCFCE7] text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]",
      };
    case "tier_1":
      return {
        shell: `border-[#E9D5FF] bg-[#FCF8FF] dark:border-[#4B2A6B] dark:bg-[#17111F] ${glow}`,
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "tier_2":
      return {
        shell: `border-[#BFDBFE] bg-[#F8FBFF] dark:border-[#294A78] dark:bg-[#101722] ${glow}`,
        badge: "bg-[#DBEAFE] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]",
      };
    case "bucket":
      return {
        shell: `border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19] ${glow}`,
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "subclass":
      return {
        shell: `border-[#E9DAFF] bg-[#FCFAFF] dark:border-[#312047] dark:bg-[#140D20] ${glow}`,
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "wallet":
    default:
      return {
        shell: `border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19] ${glow}`,
        badge: "bg-[#EEF4FF] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]",
      };
  }
}

function computeNodeWidth(
  level: "root" | "tier" | "bucket" | "subclass" | "wallet",
  allocationPct: number
) {
  const pct = safeNumber(allocationPct);

  switch (level) {
    case "root":
      return 360;
    case "tier":
      return clamp(280 + pct * 3.8, 280, 560);
    case "bucket":
      return clamp(230 + pct * 3.0, 230, 480);
    case "subclass":
      return clamp(205 + pct * 1.8, 205, 340);
    case "wallet":
    default:
      return clamp(205 + pct * 1.7, 205, 340);
  }
}

function computeMinHeight(
  level: "root" | "tier" | "bucket" | "subclass" | "wallet",
  allocationPct: number
) {
  const pct = safeNumber(allocationPct);

  switch (level) {
    case "root":
      return 145;
    case "tier":
      return clamp(125 + pct * 0.9, 125, 200);
    case "bucket":
      return clamp(110 + pct * 0.65, 110, 175);
    case "subclass":
      return clamp(96 + pct * 0.28, 96, 135);
    case "wallet":
    default:
      return clamp(94 + pct * 0.25, 94, 132);
  }
}

function getEmphasis(
  level: "root" | "tier" | "bucket" | "subclass" | "wallet",
  allocationPct: number
): FlowCardData["emphasis"] {
  if (level === "root") return "high";

  if (allocationPct >= 40) return "high";
  if (allocationPct >= 12) return "medium";
  return "low";
}

function FlowCardNode({ data }: NodeProps<FlowCardData>) {
  const tone = getToneClasses(data.tone, data.warning, data.pulse, data.emphasis);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${tone.shell}`}
      style={{
        width: data.width ?? 240,
        minHeight: data.minHeight ?? 100,
      }}
    >
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !bg-[#C084FC]" />

      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${tone.badge}`}>
          {data.title}
        </span>
        {data.meta ? (
          <span className="text-[10px] font-medium text-[#7E6A9F] dark:text-[#BFA9F5]">
            {data.meta}
          </span>
        ) : null}
      </div>

      {data.value ? (
        <p className="mt-3 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
          {data.value}
        </p>
      ) : null}

      {data.subtitle ? (
        <p className="mt-2 text-xs leading-5 text-[#6B5A86] dark:text-[#BFA9F5]">
          {data.subtitle}
        </p>
      ) : null}

      {data.secondary ? (
        <p className="mt-2 text-[11px] font-medium text-[#8B5CF6] dark:text-[#C084FC]">
          {data.secondary}
        </p>
      ) : null}

      {data.tertiary ? (
        <p className="mt-1 text-[10px] font-medium text-[#BE123C] dark:text-[#FDA4AF]">
          {data.tertiary}
        </p>
      ) : null}

      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !bg-[#8B5CF6]" />
    </div>
  );
}

const nodeTypes = {
  flowCard: FlowCardNode,
};

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

function buildTreeElements(
  structure?: StructureNode,
  alignmentMap?: Map<string, AlignmentTier>
) {
  const nodes: Node<FlowCardData>[] = [];
  const edges: Edge[] = [];

  if (!structure) {
    return { nodes, edges };
  }

  const ROOT_X = 820;
  const ROOT_Y = 40;
  const TIER_Y_START = 280;
  const TIER_Y_GAP = 620;
  const BUCKET_Y_OFFSET = 250;
  const SUBCLASS_Y_OFFSET = 470;
  const WALLET_Y_OFFSET = 470;
  const BUCKET_X_GAP = 620;
  const SUBCLASS_X_OFFSET = 330;
  const WALLET_X_OFFSET = 380;
  const SUBCLASS_Y_GAP = 175;
  const WALLET_Y_GAP = 175;

  nodes.push({
    id: "root",
    type: "flowCard",
    position: { x: ROOT_X, y: ROOT_Y },
    data: {
      title: structure.label,
      value: formatCurrency(structure.total_value_usd),
      subtitle: structure.description,
      meta: `${structure.wallet_count} wallets`,
      secondary: "100.0% of total structure",
      tone: "root",
      width: computeNodeWidth("root", 100),
      minHeight: computeMinHeight("root", 100),
      emphasis: "high",
    },
    draggable: true,
  });

  structure.children.forEach((tier, tierIndex) => {
    const tierId = `tier-${tier.key}`;
    const tierY = TIER_Y_START + tierIndex * TIER_Y_GAP;
    const tierAlignment = alignmentMap?.get(tier.key);
    const tierTone = getTierTone(tier.key);
    const tierEdgeColor = getTierEdgeColor(tier.key);
    const alignmentStyle = getAlignmentStyle(tierAlignment?.status);

    nodes.push({
      id: tierId,
      type: "flowCard",
      position: { x: ROOT_X, y: tierY },
      data: {
        title: tier.label,
        value: formatCurrency(tier.total_value_usd),
        subtitle: tier.description,
        meta: `${formatPercent(tier.allocation_pct)} • ${tier.wallet_count} wallets`,
        secondary: tierAlignment
          ? `Target ${formatPercent(tierAlignment.target_pct)} • Δ ${formatPercent(
              tierAlignment.deviation_pct
            )}`
          : undefined,
        tertiary: tierAlignment ? alignmentStyle.label : undefined,
        tone: tierTone,
        width: computeNodeWidth("tier", tier.allocation_pct),
        minHeight: computeMinHeight("tier", tier.allocation_pct),
        warning: tierAlignment?.status === "warning",
        pulse: tierAlignment?.status === "warning",
        emphasis: getEmphasis("tier", tier.allocation_pct),
      },
      draggable: true,
    });

    edges.push({
      id: `edge-root-${tierId}`,
      source: "root",
      target: tierId,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 4, stroke: tierEdgeColor },
    });

    const bucketCount = tier.children.length || 1;
    const bucketCenterOffset = ((bucketCount - 1) * BUCKET_X_GAP) / 2;

    tier.children.forEach((bucket, bucketIndex) => {
      const bucketId = `${tierId}-bucket-${bucket.key}`;
      const bucketX = ROOT_X - bucketCenterOffset + bucketIndex * BUCKET_X_GAP;
      const bucketY = tierY + BUCKET_Y_OFFSET;
      const bucketWarning = safeNumber(bucket.allocation_pct) >= 60;

      nodes.push({
        id: bucketId,
        type: "flowCard",
        position: { x: bucketX, y: bucketY },
        data: {
          title: bucket.label,
          value: formatCompactCurrency(bucket.total_value_usd),
          subtitle: `${bucket.wallet_count} wallets • ${bucket.holding_count} holdings`,
          meta: formatPercent(bucket.allocation_pct),
          secondary: `${formatPercent(bucket.allocation_pct)} of total structure`,
          tone: "bucket",
          width: computeNodeWidth("bucket", bucket.allocation_pct),
          minHeight: computeMinHeight("bucket", bucket.allocation_pct),
          warning: bucketWarning,
          emphasis: getEmphasis("bucket", bucket.allocation_pct),
        },
        draggable: true,
      });

      edges.push({
        id: `edge-${tierId}-${bucketId}`,
        source: tierId,
        target: bucketId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 3, stroke: tierEdgeColor },
      });

      bucket.children.forEach((subclass, subclassIndex) => {
        const subclassId = `${bucketId}-subclass-${subclass.key}`;
        const subclassX = bucketX - SUBCLASS_X_OFFSET;
        const subclassY = bucketY + SUBCLASS_Y_OFFSET + subclassIndex * SUBCLASS_Y_GAP;

        const pctOfParent =
          bucket.total_value_usd > 0
            ? (safeNumber(subclass.total_value_usd) / safeNumber(bucket.total_value_usd)) * 100
            : 0;

        nodes.push({
          id: subclassId,
          type: "flowCard",
          position: { x: subclassX, y: subclassY },
          data: {
            title: subclass.label,
            value: formatCompactCurrency(subclass.total_value_usd),
            subtitle: `${subclass.holding_count} holdings`,
            meta: formatPercent(subclass.allocation_pct),
            secondary: `${formatPercent(pctOfParent)} of ${bucket.label}`,
            tone: "subclass",
            width: computeNodeWidth("subclass", subclass.allocation_pct),
            minHeight: computeMinHeight("subclass", subclass.allocation_pct),
            emphasis: getEmphasis("subclass", subclass.allocation_pct),
          },
          draggable: true,
        });

        edges.push({
          id: `edge-${bucketId}-${subclassId}`,
          source: bucketId,
          target: subclassId,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2, stroke: "#C4B5FD" },
        });
      });

      bucket.wallets.forEach((wallet, walletIndex) => {
        const walletId = `${bucketId}-wallet-${wallet.wallet_id ?? wallet.wallet_name}-${walletIndex}`;
        const walletX = bucketX + WALLET_X_OFFSET;
        const walletY = bucketY + WALLET_Y_OFFSET + walletIndex * WALLET_Y_GAP;

        const pctOfParent =
          bucket.total_value_usd > 0
            ? (safeNumber(wallet.total_value_usd) / safeNumber(bucket.total_value_usd)) * 100
            : 0;

        const pctOfTotal =
          structure.total_value_usd > 0
            ? (safeNumber(wallet.total_value_usd) / safeNumber(structure.total_value_usd)) * 100
            : 0;

        nodes.push({
          id: walletId,
          type: "flowCard",
          position: { x: walletX, y: walletY },
          data: {
            title: wallet.wallet_name,
            value: formatCompactCurrency(wallet.total_value_usd),
            subtitle: `${wallet.role} • ${wallet.network_group}`,
            meta: wallet.wallet_address_short,
            secondary: `${formatPercent(pctOfParent)} of ${bucket.label}`,
            tertiary: `${formatPercent(pctOfTotal)} of total MMII`,
            tone: "wallet",
            width: computeNodeWidth("wallet", pctOfTotal),
            minHeight: computeMinHeight("wallet", pctOfTotal),
            emphasis: getEmphasis("wallet", pctOfTotal),
          },
          draggable: true,
        });

        edges.push({
          id: `edge-${bucketId}-${walletId}`,
          source: bucketId,
          target: walletId,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2.2, stroke: "#60A5FA" },
        });
      });
    });
  });

  return { nodes, edges };
}

function AlignmentChip({ tier }: { tier: AlignmentTier }) {
  const style = getAlignmentStyle(tier.status);

  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white p-3 dark:border-[#2A1D3B] dark:bg-[#100A19]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
          {tier.label}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.className}`}>
          {style.label}
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
        {formatPercent(tier.actual_pct)}
      </p>
      <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
        Target {formatPercent(tier.target_pct)} • Δ {formatPercent(tier.deviation_pct)}
      </p>
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
  const structure = data?.structure;

  const alignmentTiers = useMemo(() => buildAlignmentTiers(structure), [structure]);
  const alignmentScore = useMemo(() => computeAlignmentScore(alignmentTiers), [alignmentTiers]);
  const alignmentHeadline = useMemo(() => getAlignmentHeadline(alignmentScore), [alignmentScore]);
  const alignmentInsight = useMemo(() => getAlignmentInsight(alignmentTiers), [alignmentTiers]);
  const alignmentMap = useMemo(() => getTierAlignmentMap(alignmentTiers), [alignmentTiers]);

  const { nodes, edges } = useMemo(
    () => buildTreeElements(structure, alignmentMap),
    [structure, alignmentMap]
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
              wallet placement, and MMII alignment drift within the broader system.
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
              value={summary?.dominant_tier || "—"}
              sublabel="Highest-value structural layer"
            />
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-4 desktop:flex-row desktop:items-start desktop:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                  MMII Alignment Meter
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                  {alignmentScore}/100
                </h2>
                <p className="mt-1 text-sm font-medium text-[#6D28D9] dark:text-[#D8B4FE]">
                  {alignmentHeadline}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                  {alignmentInsight}
                </p>
              </div>

              <div className="min-w-[260px] rounded-2xl bg-[#F8F4FF] p-4 dark:bg-[#140D20]">
                <div className="h-3 overflow-hidden rounded-full bg-[#E9DAFF] dark:bg-[#241533]">
                  <div
                    className={`h-full rounded-full ${
                      alignmentScore >= 80
                        ? "bg-[#22C55E]"
                        : alignmentScore >= 55
                          ? "bg-[#A855F7]"
                          : alignmentScore >= 35
                            ? "bg-[#F59E0B]"
                            : "bg-[#F43F5E]"
                    }`}
                    style={{ width: `${alignmentScore}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                  First-pass MMII targets: Tier 0 = 40%, Tier 1 = 30%, Tier 2 = 30%.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 desktop:grid-cols-3">
              {alignmentTiers.map((tier) => (
                <AlignmentChip key={tier.key} tier={tier} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                MMII Structural Tree
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                Interactive structure canvas of MMII. Pan, zoom, and inspect how
                the strategy flows from the MMII root into tiers, buckets, subclasses,
                and wallet nodes. Node scale now reflects portfolio weighting, and
                warning glow highlights structural drift.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[#D8B4FE] bg-[#FCFAFF] p-3 dark:border-[#3B2A57] dark:bg-[#140D20]">
              <div className="h-[1700px] overflow-hidden rounded-2xl border border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19]">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  defaultViewport={{ x: -160, y: 0, zoom: 0.78 }}
                  minZoom={0.35}
                  maxZoom={1.5}
                  defaultEdgeOptions={{
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { strokeWidth: 2, stroke: "#C084FC" },
                  }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={20} size={1} color="#E9DAFF" />
                  <Controls />
                </ReactFlow>
              </div>

              <div className="mt-4 rounded-xl bg-[#F8F4FF] px-4 py-3 text-sm text-[#6B5A86] dark:bg-[#100A19] dark:text-[#BFA9F5]">
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