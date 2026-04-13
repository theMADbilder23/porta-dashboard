"use client";

import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
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
  core_layer_key: string;
  core_layer_label: string;
  tier_key: string;
  total_value_usd: number;
  snapshot_time: string | null;
};

type DrilldownSubclass = {
  key: string;
  label: string;
  total_value_usd: number;
  allocation_pct: number;
  holding_count: number;
  assets: Array<{
    asset_id: string;
    token_symbol: string;
    value_usd: number;
    yield_profile: string;
  }>;
};

type DrilldownExample = {
  asset_id: string;
  token_symbol: string;
  value_usd: number;
  mmii_subclass: string;
  yield_profile: string;
  protocol: string;
};

type DrilldownMeta = {
  subclasses: DrilldownSubclass[];
  wallets: WalletNode[];
  examples: DrilldownExample[];
  total_holdings: number;
};

type StructureNode = {
  key: string;
  label: string;
  type: "root" | "tier" | "core_layer";
  description: string;
  total_value_usd: number;
  allocation_pct: number;
  wallet_count: number;
  holding_count: number;
  children: StructureNode[];
  wallets: WalletNode[];
  meta?: {
    dominant_tier?: string;
    drilldown?: DrilldownMeta;
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

type FlowCardTone =
  | "root"
  | "tier_0"
  | "tier_1"
  | "tier_2"
  | "core_layer"
  | "label";

type FlowCardData = {
  nodeKey: string;
  title: string;
  subtitle?: string;
  value?: string;
  meta?: string;
  secondary?: string;
  tertiary?: string;
  tone?: FlowCardTone;
  width?: number;
  minHeight?: number;
  warning?: boolean;
  pulse?: boolean;
  emphasis?: "high" | "medium" | "low";
  interactive?: boolean;
  onSelect?: (nodeKey: string) => void;
};

type TierKey = "tier_0" | "tier_1" | "tier_2";

type XY = {
  x: number;
  y: number;
};

type TierPositionMap = Record<TierKey, XY>;
type CoreLayerPositionMap = Record<TierKey, Record<string, XY>>;

function isTierKey(value: string): value is TierKey {
  return value === "tier_0" || value === "tier_1" || value === "tier_2";
}

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

  return (structure.children ?? [])
    .filter((tier): tier is StructureNode & { key: TierKey } => isTierKey(tier.key))
    .map((tier) => {
      const targetPct = targets[tier.key];
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
  if (!alignmentTiers.length) return "No tier alignment data available yet.";

  const mostDrifted = [...alignmentTiers].sort(
    (a, b) => Math.abs(b.deviation_pct) - Math.abs(a.deviation_pct)
  )[0];

  if (!mostDrifted) return "MMII structure appears neutral.";

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

function getTierTone(tierKey: TierKey): FlowCardTone {
  if (tierKey === "tier_0") return "tier_0";
  if (tierKey === "tier_1") return "tier_1";
  return "tier_2";
}

function getTierEdgeColor(tierKey: TierKey) {
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
  if (tone === "label") {
    return {
      shell: "border-transparent bg-transparent shadow-none",
      badge: "",
    };
  }

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
    case "core_layer":
    default:
      return {
        shell: `border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19] ${glow}`,
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
  }
}

function computeNodeWidth(
  level: "root" | "tier" | "core_layer",
  allocationPct: number
) {
  const pct = safeNumber(allocationPct);

  switch (level) {
    case "root":
      return 360;
    case "tier":
      return clamp(290 + pct * 3.4, 290, 540);
    case "core_layer":
    default:
      return clamp(250 + pct * 2.8, 250, 470);
  }
}

function computeMinHeight(
  level: "root" | "tier" | "core_layer",
  allocationPct
  ) {
  const pct = safeNumber(allocationPct);

  switch (level) {
    case "root":
      return 145;
    case "tier":
      return clamp(128 + pct * 0.8, 128, 190);
    case "core_layer":
    default:
      return clamp(112 + pct * 0.55, 112, 165);
  }
}

function getEmphasis(
  level: "root" | "tier" | "core_layer",
  allocationPct: number
): FlowCardData["emphasis"] {
  if (level === "root") return "high";
  if (allocationPct >= 40) return "high";
  if (allocationPct >= 12) return "medium";
  return "low";
}

function FlowCardNode({ data }: NodeProps<FlowCardData>) {
  if (data.tone === "label") {
    return (
      <div className="rounded-xl bg-white/80 px-3 py-2 text-center shadow-sm dark:bg-[#100A19]/80">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B5CF6] dark:text-[#C084FC]">
          {data.title}
        </p>
        {data.subtitle ? (
          <p className="mt-1 text-[10px] text-[#6B5A86] dark:text-[#BFA9F5]">
            {data.subtitle}
          </p>
        ) : null}
      </div>
    );
  }

  const tone = getToneClasses(data.tone, data.warning, data.pulse, data.emphasis);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition-all ${tone.shell} ${
        data.interactive ? "cursor-pointer hover:scale-[1.015]" : ""
      }`}
      style={{
        width: data.width ?? 240,
        minHeight: data.minHeight ?? 100,
      }}
      onClick={() => {
        if (data.interactive && data.onSelect) {
          data.onSelect(data.nodeKey);
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !bg-[#C084FC]"
      />

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

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !bg-[#8B5CF6]"
      />
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

function SubclassCard({ subclass }: { subclass: DrilldownSubclass }) {
  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white p-3 dark:border-[#312047] dark:bg-[#100A19]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {subclass.label}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {subclass.holding_count} holdings
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[#6D28D9] dark:text-[#D8B4FE]">
            {formatCompactCurrency(subclass.total_value_usd)}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {formatPercent(subclass.allocation_pct)}
          </p>
        </div>
      </div>

      {subclass.assets.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {subclass.assets.map((asset, index) => (
            <span
              key={`${subclass.key}-${asset.asset_id || asset.token_symbol}-${index}`}
              className="rounded-full bg-[#F3E8FF] px-2.5 py-1 text-[10px] font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]"
            >
              {asset.token_symbol || "Unknown"} · {formatCompactCurrency(asset.value_usd)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WalletCard({ wallet }: { wallet: WalletNode }) {
  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white p-3 dark:border-[#312047] dark:bg-[#100A19]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {wallet.wallet_name}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {wallet.role} • {wallet.network_group}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[#2563EB] dark:text-[#93C5FD]">
            {formatCompactCurrency(wallet.total_value_usd)}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {wallet.wallet_address_short}
          </p>
        </div>
      </div>
    </div>
  );
}

function ExampleAssetCard({ asset }: { asset: DrilldownExample }) {
  return (
    <div className="rounded-xl border border-[#E9DAFF] bg-white p-3 dark:border-[#312047] dark:bg-[#100A19]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {asset.token_symbol || "Unknown"}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {asset.mmii_subclass || "Unclassified"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[#6D28D9] dark:text-[#D8B4FE]">
            {formatCompactCurrency(asset.value_usd)}
          </p>
          <p className="mt-1 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
            {asset.protocol || asset.yield_profile || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function buildNodeLookup(structure?: StructureNode) {
  const map = new Map<string, StructureNode>();

  function walk(node?: StructureNode) {
    if (!node) return;
    map.set(node.key, node);
    node.children.forEach((child) => walk(child));
  }

  walk(structure);
  return map;
}

function buildTreeElements(
  structure: StructureNode | undefined,
  alignmentMap: Map<string, AlignmentTier>,
  onSelectBucket: (nodeKey: string) => void
) {
  const nodes: Node<FlowCardData>[] = [];
  const edges: Edge[] = [];

  if (!structure) {
    return { nodes, edges };
  }

  const rootX = 1080;
  const rootY = 40;

  const tierPositions: TierPositionMap = {
    tier_0: { x: 1080, y: 300 },
    tier_1: { x: 520, y: 820 },
    tier_2: { x: 1640, y: 820 },
  };

  nodes.push({
    id: "root",
    type: "flowCard",
    position: { x: rootX, y: rootY },
    data: {
      nodeKey: structure.key,
      title: structure.label,
      value: formatCurrency(structure.total_value_usd),
      subtitle: structure.description,
      meta: `${structure.wallet_count} wallets`,
      secondary: "100.0% of total structure",
      tone: "root",
      width: computeNodeWidth("root", 100),
      minHeight: computeMinHeight("root", 100),
      emphasis: "high",
      interactive: false,
    },
    draggable: true,
  });

  nodes.push({
    id: "label-root-tier",
    type: "flowCard",
    position: { x: rootX - 70, y: 185 },
    data: {
      nodeKey: "label-root-tier",
      title: "Foundation Routing",
      subtitle: "Root capital staging into structural tiers",
      tone: "label",
      width: 180,
      minHeight: 40,
    },
    draggable: false,
    selectable: false,
  });

  const tiersByKey = new Map((structure.children ?? []).map((tier) => [tier.key, tier]));
  const tier0 = tiersByKey.get("tier_0");
  const tier1 = tiersByKey.get("tier_1");
  const tier2 = tiersByKey.get("tier_2");

  const tierRenderOrder = [tier0, tier1, tier2].filter(
    (tier): tier is StructureNode & { key: TierKey } => Boolean(tier && isTierKey(tier.key))
  );

  for (const tier of tierRenderOrder) {
    const tierId = `tier-${tier.key}`;
    const tierPosition = tierPositions[tier.key];
    const tierAlignment = alignmentMap.get(tier.key);
    const tierTone = getTierTone(tier.key);
    const tierEdgeColor = getTierEdgeColor(tier.key);
    const alignmentStyle = getAlignmentStyle(tierAlignment?.status);

    nodes.push({
      id: tierId,
      type: "flowCard",
      position: tierPosition,
      data: {
        nodeKey: tier.key,
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
        interactive: false,
      },
      draggable: true,
    });

    if (tier.key === "tier_0") {
      edges.push({
        id: `edge-root-${tierId}`,
        source: "root",
        target: tierId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 4, stroke: tierEdgeColor },
      });
    } else {
      edges.push({
        id: `edge-tier0-${tierId}`,
        source: "tier-tier_0",
        target: tierId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 4, stroke: tierEdgeColor },
      });
    }
  }

  const tierCoreLayerPositions: CoreLayerPositionMap = {
    tier_0: {
      stable_core: { x: 1080, y: 620 },
    },
    tier_1: {
      rotational_core: { x: 330, y: 1120 },
    },
    tier_2: {
      rotational_anchors: { x: 1350, y: 1120 },
      growth: { x: 1700, y: 1120 },
      swing: { x: 2050, y: 1120 },
    },
  };

  for (const tier of tierRenderOrder) {
    const tierId = `tier-${tier.key}`;
    const tierEdgeColor = getTierEdgeColor(tier.key);
    const layerPositions = tierCoreLayerPositions[tier.key];

    if (tier.children.length > 0) {
      nodes.push({
        id: `label-${tierId}-corelayer`,
        type: "flowCard",
        position: {
          x: tierPositions[tier.key].x - 90,
          y: tierPositions[tier.key].y + 180,
        },
        data: {
          nodeKey: `label-${tierId}-corelayer`,
          title:
            tier.key === "tier_0"
              ? "Stable Core Routing"
              : tier.key === "tier_1"
                ? "Collateralized Yield Routing"
                : "Direct Allocation Routing",
          subtitle:
            tier.key === "tier_0"
              ? "Tier 0 into permanent yield base"
              : tier.key === "tier_1"
                ? "Tier 1 into rotational yield sleeves"
                : "Tier 2 into growth, anchors, and swing",
          tone: "label",
          width: 210,
          minHeight: 42,
        },
        draggable: false,
        selectable: false,
      });
    }

    for (const coreLayer of tier.children) {
      const coreLayerId = `${tierId}-core-${coreLayer.key}`;
      const position = layerPositions[coreLayer.key] ?? {
        x: tierPositions[tier.key].x + 120,
        y: tierPositions[tier.key].y + 300,
      };

      const coreWarning = safeNumber(coreLayer.allocation_pct) >= 60;

      nodes.push({
        id: coreLayerId,
        type: "flowCard",
        position,
        data: {
          nodeKey: coreLayer.key,
          title: coreLayer.label,
          value: formatCompactCurrency(coreLayer.total_value_usd),
          subtitle: `${coreLayer.wallet_count} wallets • ${coreLayer.holding_count} holdings`,
          meta: formatPercent(coreLayer.allocation_pct),
          secondary: `${formatPercent(coreLayer.allocation_pct)} of total structure`,
          tertiary: "Click to inspect execution layer",
          tone: "core_layer",
          width: computeNodeWidth("core_layer", coreLayer.allocation_pct),
          minHeight: computeMinHeight("core_layer", coreLayer.allocation_pct),
          warning: coreWarning,
          emphasis: getEmphasis("core_layer", coreLayer.allocation_pct),
          interactive: true,
          onSelect: onSelectBucket,
        },
        draggable: true,
      });

      edges.push({
        id: `edge-${tierId}-${coreLayerId}`,
        source: tierId,
        target: coreLayerId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 3, stroke: tierEdgeColor },
      });
    }
  }

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
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

  const summary = data?.summary;
  const structure = data?.structure;

  const alignmentTiers = useMemo(() => buildAlignmentTiers(structure), [structure]);
  const alignmentScore = useMemo(() => computeAlignmentScore(alignmentTiers), [alignmentTiers]);
  const alignmentHeadline = useMemo(() => getAlignmentHeadline(alignmentScore), [alignmentScore]);
  const alignmentInsight = useMemo(() => getAlignmentInsight(alignmentTiers), [alignmentTiers]);
  const alignmentMap = useMemo(() => getTierAlignmentMap(alignmentTiers), [alignmentTiers]);
  const nodeLookup = useMemo(() => buildNodeLookup(structure), [structure]);

  const selectedBucket =
    selectedBucketKey && nodeLookup.has(selectedBucketKey)
      ? nodeLookup.get(selectedBucketKey) || null
      : null;

  const builtTree = useMemo(
    () => buildTreeElements(structure, alignmentMap, setSelectedBucketKey),
    [structure, alignmentMap]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowCardData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

  useEffect(() => {
    setNodes(builtTree.nodes);
    setEdges(builtTree.edges);
  }, [builtTree, setNodes, setEdges]);

  useEffect(() => {
    if (!selectedBucketKey) return;
    if (!nodeLookup.has(selectedBucketKey)) {
      setSelectedBucketKey(null);
    }
  }, [selectedBucketKey, nodeLookup]);

  const drilldown = selectedBucket?.meta?.drilldown;

  return (
    <div className="min-h-screen space-y-
    6 p-6">
      <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
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
              portfolio capital through MMII tiers and core layers, while the
              execution layer is opened separately through bucket drilldown.
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
                the strategy flows from the MMII root into tiers and core layers.
                Click a bucket to inspect its execution layer in the side panel.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[#D8B4FE] bg-[#FCFAFF] p-3 dark:border-[#3B2A57] dark:bg-[#140D20]">
              <div className="relative h-[1800px] overflow-hidden rounded-2xl border border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19]">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  defaultViewport={{ x: -180, y: 0, zoom: 0.62 }}
                  minZoom={0.3}
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

          {selectedBucket ? (
            <section className="rounded-2xl border border-[#E9DAFF] bg-white p-6 shadow-sm dark:border-[#2A1D3B] dark:bg-[#100A19]">
              <div className="flex flex-col gap-4 desktop:flex-row desktop:items-start desktop:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
                    Bucket Execution Layer
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                    {selectedBucket.label}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                    {selectedBucket.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBucketKey(null)}
                  className="rounded-xl border border-[#E9DAFF] bg-white px-4 py-2 text-sm font-medium text-[#6D28D9] transition-colors hover:bg-[#F3E8FF] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
                >
                  Close Drilldown
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-4">
                <MetricCard
                  label="Bucket Value"
                  value={formatCurrency(selectedBucket.total_value_usd)}
                  sublabel={`${formatPercent(selectedBucket.allocation_pct)} of total MMII`}
                />
                <MetricCard
                  label="Wallets"
                  value={String(selectedBucket.wallet_count)}
                  sublabel="Active deployment wallets"
                />
                <MetricCard
                  label="Holdings"
                  value={String(drilldown?.total_holdings ?? selectedBucket.holding_count)}
                  sublabel="Tracked holdings in bucket"
                />
                <MetricCard
                  label="Subclasses"
                  value={String(drilldown?.subclasses.length ?? 0)}
                  sublabel="MMII sleeves in bucket"
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 desktop:grid-cols-12">
                <div className="desktop:col-span-4 space-y-4">
                  <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 dark:border-[#312047] dark:bg-[#140D20]">
                    <h3 className="text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      Subclass Sleeves
                    </h3>
                    <p className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                      Internal MMII sleeves grouped within this bucket.
                    </p>

                    <div className="mt-4 space-y-3">
                      {drilldown?.subclasses?.length ? (
                        drilldown.subclasses.map((subclass) => (
                          <SubclassCard key={subclass.key} subclass={subclass} />
                        ))
                      ) : (
                        <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                          No subclass sleeves available for this bucket yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="desktop:col-span-4 space-y-4">
                  <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 dark:border-[#312047] dark:bg-[#140D20]">
                    <h3 className="text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      Wallet Deployment
                    </h3>
                    <p className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                      Wallets currently mapped into this execution layer.
                    </p>

                    <div className="mt-4 space-y-3">
                      {drilldown?.wallets?.length ? (
                        drilldown.wallets.map((wallet) => (
                          <WalletCard
                            key={wallet.wallet_id || `${wallet.wallet_name}-${wallet.wallet_address_short}`}
                            wallet={wallet}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                          No wallet deployment entries available for this bucket yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="desktop:col-span-4 space-y-4">
                  <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 dark:border-[#312047] dark:bg-[#140D20]">
                    <h3 className="text-lg font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                      Example Assets
                    </h3>
                    <p className="mt-1 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                      Sample holdings captured within the selected bucket.
                    </p>

                    <div className="mt-4 space-y-3">
                      {drilldown?.examples?.length ? (
                        drilldown.examples.map((asset, index) => (
                          <ExampleAssetCard
                            key={`${asset.asset_id || asset.token_symbol}-${index}`}
                            asset={asset}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                          No example asset records available for this bucket yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-[#D8B4FE] bg-[#FCFAFF] p-6 shadow-sm dark:border-[#3B2A57] dark:bg-[#140D20]">
              <h2 className="text-xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                Bucket Drilldown
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                Click a core layer bucket in the structural tree above to inspect its
                subclasses, wallet deployment, and example assets without overcrowding
                the main canvas.
              </p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}