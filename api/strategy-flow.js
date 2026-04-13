const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeString(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return safeString(value).toLowerCase();
}

function truncateAddress(address) {
  const value = safeString(address);
  if (!value) return "Unavailable";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function formatLabel(value) {
  const text = safeString(value);
  if (!text) return "Unclassified";

  return text
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createNode({
  key,
  label,
  type,
  description = "",
  total_value_usd = 0,
  allocation_pct = 0,
  wallet_count = 0,
  holding_count = 0,
  children = [],
  wallets = [],
  meta = {},
}) {
  return {
    key,
    label,
    type,
    description,
    total_value_usd,
    allocation_pct,
    wallet_count,
    holding_count,
    children,
    wallets,
    meta,
  };
}

function getWalletId(wallet) {
  return wallet?.wallet_id || wallet?.id || null;
}

function getWalletDisplayName(wallet) {
  return (
    safeString(wallet?.wallet_name) ||
    safeString(wallet?.name) ||
    safeString(wallet?.label) ||
    "Unnamed Wallet"
  );
}

function getWalletAddress(wallet) {
  return safeString(wallet?.wallet_address) || safeString(wallet?.address) || null;
}

function getWalletRole(wallet) {
  return safeString(wallet?.role) || safeString(wallet?.wallet_role) || "Unassigned";
}

function getWalletNetworkGroup(wallet) {
  return (
    safeString(wallet?.network_group) ||
    safeString(wallet?.chain_group) ||
    "Unknown"
  );
}

function getWalletType(wallet) {
  return safeString(wallet?.wallet_type) || safeString(wallet?.account_type) || "Unknown";
}

function getWalletStatus(wallet) {
  if (wallet?.is_active === false) return "Inactive";
  return "Active";
}

function getSnapshotValue(snapshot) {
  if (!snapshot) return 0;
  return safeNumber(snapshot.total_value_usd) + safeNumber(snapshot.total_pending_usd);
}

function computeAllocation(value, total) {
  if (total <= 0) return 0;
  return (safeNumber(value) / total) * 100;
}

function serializeWallet(wallet, snapshot, coreLayerKey, tierKey) {
  return {
    wallet_id: getWalletId(wallet),
    wallet_name: getWalletDisplayName(wallet),
    wallet_address: getWalletAddress(wallet),
    wallet_address_short: truncateAddress(getWalletAddress(wallet)),
    role: getWalletRole(wallet),
    wallet_type: getWalletType(wallet),
    network_group: getWalletNetworkGroup(wallet),
    status: getWalletStatus(wallet),
    core_layer_key: coreLayerKey,
    core_layer_label: formatLabel(coreLayerKey),
    tier_key: tierKey,
    total_value_usd: getSnapshotValue(snapshot),
    snapshot_time: snapshot?.snapshot_time || null,
  };
}

function getTierDefinitions() {
  return {
    tier_0: {
      key: "tier_0",
      label: "Tier 0 — Foundational Hub",
      description: "Permanent yield layer and stable core foundation of MMII.",
      coreLayers: ["stable_core"],
    },
    tier_1: {
      key: "tier_1",
      label: "Tier 1 — Collateralized Liquidity",
      description:
        "Yield-on-yield engine sourced from rotational core collateralized liquidity.",
      coreLayers: ["rotational_core"],
    },
    tier_2: {
      key: "tier_2",
      label: "Tier 2 — Direct Allocation",
      description:
        "Direct non-collateralized deployment into growth, rotational anchors, and swing structure.",
      coreLayers: ["growth", "rotational_anchors", "swing"],
    },
  };
}

function getCoreLayerDefinitions() {
  return {
    stable_core: {
      key: "stable_core",
      label: "Stable Core",
      description: "Permanent yield and stable foundation layer.",
      tier_key: "tier_0",
    },
    rotational_core: {
      key: "rotational_core",
      label: "Rotational Core",
      description:
        "Collateralized rotational yield layer for HAYP, metals yield, and core digital reserve yield.",
      tier_key: "tier_1",
    },
    rotational_anchors: {
      key: "rotational_anchors",
      label: "Rotational Anchors",
      description:
        "Direct rotational anchor sleeves such as Genesis10, GeoEdge, and reserve sleeves.",
      tier_key: "tier_2",
    },
    growth: {
      key: "growth",
      label: "Growth",
      description:
        "Growth yield and growth hold sleeves across DeFi, RWA, AI, gaming, and similar sectors.",
      tier_key: "tier_2",
    },
    swing: {
      key: "swing",
      label: "Swing",
      description:
        "Short-term trading, narrative rotation, and swing deployment layer.",
      tier_key: "tier_2",
    },
  };
}

function buildEmptyCoreLayerAccumulator(definition) {
  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    tier_key: definition.tier_key,
    total_value_usd: 0,
    wallet_count: 0,
    holding_count: 0,
    wallets: [],
    holdings: [],
  };
}

function buildHoldingContext(holdings) {
  const bySubclass = new Map();
  const byBucket = new Map();

  for (const holding of holdings) {
    const subclass = normalize(holding.mmii_subclass);
    const bucket = normalize(holding.mmii_bucket);
    const value = safeNumber(holding.value_usd);

    if (subclass) {
      bySubclass.set(subclass, safeNumber(bySubclass.get(subclass)) + value);
    }
    if (bucket) {
      byBucket.set(bucket, safeNumber(byBucket.get(bucket)) + value);
    }
  }

  const dominantSubclass =
    [...bySubclass.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const dominantBucket =
    [...byBucket.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  return {
    dominantSubclass,
    dominantBucket,
  };
}

function resolveCoreLayerKey(wallet, walletHoldings) {
  const walletName = normalize(getWalletDisplayName(wallet));
  const walletRole = normalize(getWalletRole(wallet));
  const walletDefaultBucket = normalize(wallet?.default_mmii_bucket);
  const { dominantSubclass, dominantBucket } = buildHoldingContext(walletHoldings);

  const bucket = dominantBucket || walletDefaultBucket;

  if (
    walletName.includes("core vault") ||
    bucket === "stable_core" ||
    [
      "stable_collateralized",
      "stable_non_collateralized",
      "stable_yield",
      "cre_stable_yield",
    ].includes(dominantSubclass)
  ) {
    return "stable_core";
  }

  if (
    bucket === "rotational_core" &&
    ["hayp", "gold_silver_yield", "digital_reserve_yield"].includes(dominantSubclass)
  ) {
    return "rotational_core";
  }

  if (
    bucket === "rotational_core" &&
    ["genesis10", "gold_silver_reserve", "geoedge", "digital_reserve"].includes(
      dominantSubclass
    )
  ) {
    return "rotational_anchors";
  }

  if (
    walletRole.includes("swing") ||
    walletRole.includes("trading") ||
    walletName.includes("swing") ||
    dominantSubclass === "short_term_narrative" ||
    bucket === "swing"
  ) {
    return "swing";
  }

  if (
    bucket === "growth" ||
    walletName.includes("yield vault") ||
    walletName.includes("qubic") ||
    walletName.includes("hub") ||
    [
      "defi_growth_yield",
      "rwa_growth_yield",
      "realfi10",
      "nova10",
      "private_markets",
    ].includes(dominantSubclass)
  ) {
    return "growth";
  }

  if (bucket === "rotational_core") {
    return "rotational_core";
  }

  return "growth";
}

async function fetchWalletsWithFallback() {
  const lower = await supabase.from("wallets").select("*");
  if (!lower.error) return lower;

  const msg = normalize(lower.error?.message);
  if (
    msg.includes('relation "wallets" does not exist') ||
    msg.includes("could not find the table")
  ) {
    return supabase.from("Wallets").select("*");
  }

  return lower;
}

function buildSubclassDrilldown(coreLayerHoldings, totalPortfolioValue) {
  const grouped = new Map();

  for (const holding of coreLayerHoldings) {
    const subclassKey =
      normalize(holding.mmii_subclass) ||
      normalize(holding.yield_profile) ||
      "unclassified";

    if (!grouped.has(subclassKey)) {
      grouped.set(subclassKey, {
        total_value_usd: 0,
        holding_count: 0,
        assets: [],
      });
    }

    const current = grouped.get(subclassKey);
    current.total_value_usd += safeNumber(holding.value_usd);
    current.holding_count += 1;

    if (current.assets.length < 10) {
      current.assets.push({
        asset_id: safeString(holding.asset_id),
        token_symbol:
          safeString(holding.token_symbol || holding.asset_symbol) || "Unknown",
        value_usd: safeNumber(holding.value_usd),
        yield_profile: safeString(holding.yield_profile) || "none",
      });
    }
  }

  return [...grouped.entries()]
    .map(([subclassKey, data]) => ({
      key: subclassKey,
      label: formatLabel(subclassKey),
      total_value_usd: data.total_value_usd,
      allocation_pct: computeAllocation(data.total_value_usd, totalPortfolioValue),
      holding_count: data.holding_count,
      assets: data.assets,
    }))
    .sort((a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd));
}

function buildBucketExamples(holdings) {
  return [...holdings]
    .sort((a, b) => safeNumber(b.value_usd) - safeNumber(a.value_usd))
    .slice(0, 8)
    .map((holding) => ({
      asset_id: safeString(holding.asset_id),
      token_symbol:
        safeString(holding.token_symbol || holding.asset_symbol) || "Unknown",
      value_usd: safeNumber(holding.value_usd),
      mmii_subclass: safeString(holding.mmii_subclass) || "Unclassified",
      yield_profile: safeString(holding.yield_profile) || "none",
      protocol: safeString(holding.protocol) || "Unknown",
    }));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [walletsResult, snapshotsResult, holdingsResult] = await Promise.all([
      fetchWalletsWithFallback(),
      supabase.from("wallet_snapshots").select("*").order("snapshot_time", {
        ascending: false,
      }),
      supabase.from("wallet_holdings").select("*").order("snapshot_time", {
        ascending: false,
      }),
    ]);

    if (walletsResult.error) {
      return res.status(500).json({
        error: "Failed to load wallets",
        details: walletsResult.error.message,
      });
    }

    if (snapshotsResult.error) {
      return res.status(500).json({
        error: "Failed to load wallet snapshots",
        details: snapshotsResult.error.message,
      });
    }

    if (holdingsResult.error) {
      return res.status(500).json({
        error: "Failed to load wallet holdings",
        details: holdingsResult.error.message,
      });
    }

    const wallets = Array.isArray(walletsResult.data) ? walletsResult.data : [];
    const snapshots = Array.isArray(snapshotsResult.data) ? snapshotsResult.data : [];
    const holdings = Array.isArray(holdingsResult.data) ? holdingsResult.data : [];

    const latestSnapshotsByWalletId = new Map();
    for (const snapshot of snapshots) {
      const walletId = snapshot.wallet_id || snapshot.id || null;
      if (!walletId) continue;
      if (!latestSnapshotsByWalletId.has(walletId)) {
        latestSnapshotsByWalletId.set(walletId, snapshot);
      }
    }

    const latestSnapshotIds = new Set();
    for (const snapshot of latestSnapshotsByWalletId.values()) {
      if (snapshot?.id) latestSnapshotIds.add(snapshot.id);
    }

    const holdingsByWalletId = new Map();
    for (const holding of holdings) {
      if (
        holding.snapshot_id &&
        latestSnapshotIds.size &&
        !latestSnapshotIds.has(holding.snapshot_id)
      ) {
        continue;
      }

      const walletId = holding.wallet_id || null;
      if (!walletId) continue;

      if (!holdingsByWalletId.has(walletId)) {
        holdingsByWalletId.set(walletId, []);
      }

      holdingsByWalletId.get(walletId).push(holding);
    }

    const tierDefinitions = getTierDefinitions();
    const coreLayerDefinitions = getCoreLayerDefinitions();

    const tierAccumulators = {
      tier_0: {
        ...tierDefinitions.tier_0,
        total_value_usd: 0,
        wallet_count: 0,
        holding_count: 0,
        coreLayers: new Map(),
      },
      tier_1: {
        ...tierDefinitions.tier_1,
        total_value_usd: 0,
        wallet_count: 0,
        holding_count: 0,
        coreLayers: new Map(),
      },
      tier_2: {
        ...tierDefinitions.tier_2,
        total_value_usd: 0,
        wallet_count: 0,
        holding_count: 0,
        coreLayers: new Map(),
      },
    };

    for (const definition of Object.values(coreLayerDefinitions)) {
      const tier = tierAccumulators[definition.tier_key];
      tier.coreLayers.set(definition.key, buildEmptyCoreLayerAccumulator(definition));
    }

    let totalPortfolioValue = 0;
    let trackedWalletCount = 0;

    for (const wallet of wallets) {
      const walletId = getWalletId(wallet);
      if (!walletId) continue;

      const latestSnapshot = latestSnapshotsByWalletId.get(walletId) || null;
      const walletHoldings = holdingsByWalletId.get(walletId) || [];
      const walletValue = getSnapshotValue(latestSnapshot);

      const coreLayerKey = resolveCoreLayerKey(wallet, walletHoldings);
      const coreLayerDefinition = coreLayerDefinitions[coreLayerKey];
      const tierKey = coreLayerDefinition?.tier_key || "tier_2";

      totalPortfolioValue += walletValue;
      trackedWalletCount += 1;

      const tier = tierAccumulators[tierKey];
      const coreLayer = tier.coreLayers.get(coreLayerKey);

      if (!coreLayer) continue;

      tier.total_value_usd += walletValue;
      tier.wallet_count += 1;
      tier.holding_count += walletHoldings.length;

      coreLayer.total_value_usd += walletValue;
      coreLayer.wallet_count += 1;
      coreLayer.holding_count += walletHoldings.length;
      coreLayer.wallets.push(serializeWallet(wallet, latestSnapshot, coreLayerKey, tierKey));
      coreLayer.holdings.push(...walletHoldings);
    }

    const tiers = Object.values(tierAccumulators).map((tier) => {
      const coreLayerNodes = [...tier.coreLayers.values()]
        .map((coreLayer) => {
          const sortedWallets = coreLayer.wallets.sort(
            (a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd)
          );

          const drilldown = {
            subclasses: buildSubclassDrilldown(coreLayer.holdings, totalPortfolioValue),
            wallets: sortedWallets,
            examples: buildBucketExamples(coreLayer.holdings),
            total_holdings: coreLayer.holding_count,
          };

          return createNode({
            key: coreLayer.key,
            label: coreLayer.label,
            type: "core_layer",
            description: coreLayer.description,
            total_value_usd: coreLayer.total_value_usd,
            allocation_pct: computeAllocation(coreLayer.total_value_usd, totalPortfolioValue),
            wallet_count: coreLayer.wallet_count,
            holding_count: coreLayer.holding_count,
            children: [],
            wallets: [],
            meta: {
              drilldown,
            },
          });
        })
        .sort((a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd));

      return createNode({
        key: tier.key,
        label: tier.label,
        type: "tier",
        description: tier.description,
        total_value_usd: tier.total_value_usd,
        allocation_pct: computeAllocation(tier.total_value_usd, totalPortfolioValue),
        wallet_count: tier.wallet_count,
        holding_count: tier.holding_count,
        children: coreLayerNodes,
        wallets: [],
        meta: {},
      });
    });

    const dominantTier =
      [...tiers].sort((a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd))[0]
        ?.label || "Unassigned";

    const rootNode = createNode({
      key: "mmii_root",
      label: "MMII Root Structure",
      type: "root",
      description:
        "Top-level MMII structural map showing how portfolio capital is organized through foundational tiers and core strategic layers.",
      total_value_usd: totalPortfolioValue,
      allocation_pct: 100,
      wallet_count: trackedWalletCount,
      holding_count: tiers.reduce((sum, tier) => sum + safeNumber(tier.holding_count), 0),
      children: tiers,
      wallets: [],
      meta: {
        dominant_tier: dominantTier,
      },
    });

    return res.status(200).json({
      summary: {
        total_tiers: tiers.length,
        tracked_wallets: trackedWalletCount,
        total_portfolio_value: totalPortfolioValue,
        dominant_tier: dominantTier,
      },
      structure: rootNode,
      methodology: {
        mapping_type: "mmii_tier_corelayer_bucket_drilldown_v3",
        note:
          "Main canvas now shows only MMII root, tiers, and bucket structure. Subclasses, wallets, and example holdings are exposed through bucket drilldown metadata.",
      },
    });
  } catch (error) {
    console.error("[strategy-flow] unexpected error", error);
    return res.status(500).json({
      error: "Unexpected server error",
      details: error?.message || String(error),
    });
  }
}