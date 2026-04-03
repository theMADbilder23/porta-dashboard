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

type FlowCardData = {
  title: string;
  subtitle?: string;
  value?: string;
  meta?: string;
  tone?: "root" | "tier_0" | "tier_1" | "tier_2" | "bucket" | "subclass" | "wallet";
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

function getToneClasses(tone: FlowCardData["tone"]) {
  switch (tone) {
    case "root":
      return {
        shell:
          "border-[#D8B4FE] bg-gradient-to-br from-white to-[#F8F4FF] dark:border-[#4B2A6B] dark:from-[#100A19] dark:to-[#171022]",
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "tier_0":
      return {
        shell:
          "border-[#BBF7D0] bg-[#F4FFF7] dark:border-[#1E4D2B] dark:bg-[#0F1A13]",
        badge: "bg-[#DCFCE7] text-[#15803D] dark:bg-[#102417] dark:text-[#86EFAC]",
      };
    case "tier_1":
      return {
        shell:
          "border-[#E9D5FF] bg-[#FCF8FF] dark:border-[#4B2A6B] dark:bg-[#17111F]",
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "tier_2":
      return {
        shell:
          "border-[#BFDBFE] bg-[#F8FBFF] dark:border-[#294A78] dark:bg-[#101722]",
        badge: "bg-[#DBEAFE] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]",
      };
    case "bucket":
      return {
        shell:
          "border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19]",
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "subclass":
      return {
        shell:
          "border-[#E9DAFF] bg-[#FCFAFF] dark:border-[#312047] dark:bg-[#140D20]",
        badge: "bg-[#F3E8FF] text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]",
      };
    case "wallet":
    default:
      return {
        shell:
          "border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19]",
        badge: "bg-[#EEF4FF] text-[#2563EB] dark:bg-[#131D32] dark:text-[#93C5FD]",
      };
  }
}

function FlowCardNode({ data }: NodeProps<FlowCardData>) {
  const tone = getToneClasses(data.tone);

  return (
    <div
      className={`min-w-[220px] max-w-[260px] rounded-2xl border px-4 py-3 shadow-sm ${tone.shell}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-[#C084FC]" />
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
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-[#8B5CF6]" />
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

function buildTreeElements(structure?: StructureNode) {
  const nodes: Node<FlowCardData>[] = [];
  const edges: Edge[] = [];

  if (!structure) {
    return { nodes, edges };
  }

  const ROOT_X = 700;
  const ROOT_Y = 20;
  const TIER_Y_START = 220;
  const TIER_Y_GAP = 420;
  const BUCKET_Y_OFFSET = 180;
  const SUBCLASS_Y_OFFSET = 360;
  const WALLET_Y_OFFSET = 560;
  const BUCKET_X_GAP = 460;
  const SUBCLASS_X_OFFSET = 200;
  const WALLET_X_OFFSET = 220;
  const SUBCLASS_Y_GAP = 130;
  const WALLET_Y_GAP = 130;

  nodes.push({
    id: "root",
    type: "flowCard",
    position: { x: ROOT_X, y: ROOT_Y },
    data: {
      title: structure.label,
      value: formatCurrency(structure.total_value_usd),
      subtitle: structure.description,
      meta: `${structure.wallet_count} wallets`,
      tone: "root",
    },
    draggable: true,
  });

  structure.children.forEach((tier, tierIndex) => {
    const tierId = `tier-${tier.key}`;
    const tierY = TIER_Y_START + tierIndex * TIER_Y_GAP;

    const tierTone =
      tier.key === "tier_0"
        ? "tier_0"
        : tier.key === "tier_1"
          ? "tier_1"
          : "tier_2";

    nodes.push({
      id: tierId,
      type: "flowCard",
      position: { x: ROOT_X, y: tierY },
      data: {
        title: tier.label,
        value: formatCurrency(tier.total_value_usd),
        subtitle: tier.description,
        meta: `${formatPercent(tier.allocation_pct)} • ${tier.wallet_count} wallets`,
        tone: tierTone,
      },
      draggable: true,
    });

    edges.push({
      id: `edge-root-${tierId}`,
      source: "root",
      target: tierId,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2, stroke: "#C084FC" },
    });

    const bucketCount = tier.children.length;
    const bucketCenterOffset = ((bucketCount - 1) * BUCKET_X_GAP) / 2;

    tier.children.forEach((bucket, bucketIndex) => {
      const bucketId = `${tierId}-bucket-${bucket.key}`;
      const bucketX = ROOT_X - bucketCenterOffset + bucketIndex * BUCKET_X_GAP;
      const bucketY = tierY + BUCKET_Y_OFFSET;

      nodes.push({
        id: bucketId,
        type: "flowCard",
        position: { x: bucketX, y: bucketY },
        data: {
          title: bucket.label,
          value: formatCompactCurrency(bucket.total_value_usd),
          subtitle: `${bucket.wallet_count} wallets • ${bucket.holding_count} holdings`,
          meta: formatPercent(bucket.allocation_pct),
          tone: "bucket",
        },
        draggable: true,
      });

      edges.push({
        id: `edge-${tierId}-${bucketId}`,
        source: tierId,
        target: bucketId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2, stroke: "#A78BFA" },
      });

      bucket.children.forEach((subclass, subclassIndex) => {
        const subclassId = `${bucketId}-subclass-${subclass.key}`;
        const subclassX = bucketX - SUBCLASS_X_OFFSET;
        const subclassY = bucketY + SUBCLASS_Y_OFFSET + subclassIndex * SUBCLASS_Y_GAP;

        nodes.push({
          id: subclassId,
          type: "flowCard",
          position: { x: subclassX, y: subclassY },
          data: {
            title: subclass.label,
            value: formatCompactCurrency(subclass.total_value_usd),
            subtitle: `${subclass.holding_count} holdings`,
            meta: formatPercent(subclass.allocation_pct),
            tone: "subclass",
          },
          draggable: true,
        });

        edges.push({
          id: `edge-${bucketId}-${subclassId}`,
          source: bucketId,
          target: subclassId,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 1.75, stroke: "#C4B5FD" },
        });
      });

      bucket.wallets.forEach((wallet, walletIndex) => {
        const walletId = `${bucketId}-wallet-${wallet.wallet_id ?? wallet.wallet_name}-${walletIndex}`;
        const walletX = bucketX + WALLET_X_OFFSET;
        const walletY = bucketY + WALLET_Y_OFFSET + walletIndex * WALLET_Y_GAP;

        nodes.push({
          id: walletId,
          type: "flowCard",
          position: { x: walletX, y: walletY },
          data: {
            title: wallet.wallet_name,
            value: formatCompactCurrency(wallet.total_value_usd),
            subtitle: `${wallet.role} • ${wallet.network_group}`,
            meta: wallet.wallet_address_short,
            tone: "wallet",
          },
          draggable: true,
        });

        edges.push({
          id: `edge-${bucketId}-${walletId}`,
          source: bucketId,
          target: walletId,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 1.75, stroke: "#93C5FD" },
        });
      });
    });
  });

  return { nodes, edges };
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

  const { nodes, edges } = useMemo(() => buildTreeElements(structure), [structure]);

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
              and wallet placement within the broader MMII system.
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
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                MMII Structural Tree
              </h2>
              <p className="text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
                Interactive tree canvas of the MMII structure. Pan, zoom, and inspect
                how the strategy flows from the MMII root into tiers, buckets, subclasses,
                and wallet nodes.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[#D8B4FE] bg-[#FCFAFF] p-3 dark:border-[#3B2A57] dark:bg-[#140D20]">
              <div className="h-[1150px] overflow-hidden rounded-2xl border border-[#E9DAFF] bg-white dark:border-[#312047] dark:bg-[#100A19]">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
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