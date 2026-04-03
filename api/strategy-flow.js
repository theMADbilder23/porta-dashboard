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

function getTierDefinition() {
  return {
    tier_0: {
      key: "tier_0",
      label: "Tier 0 — Foundation Hub",
      description:
        "Primary capital staging layer and stable-yield foundation of MMII.",
      bucketKeys: ["stable_core"],
      subclassKeys: [
        "stable_non_collateralized",
        "stable_collateralized",
        "stable_yield",
      ],
    },
    tier_1: {
      key: "tier_1",
      label: "Tier 1 — Collateralized Liquidity",
      description:
        "Yield-on-yield engine driven by collateralized stable capital and strategic rotation.",
      bucketKeys: ["rotational_core"],
      subclassKeys: [
        "hayp",
        "hard_asset_yield",
        "commercial_real_estate",
        "collateralized_liquidity",
      ],
    },
    tier_2: {
      key: "tier_2",
      label: "Tier 2 — Direct Yield Allocation",
      description:
        "Direct deployment layer for growth, digital reserve, reserve sleeves, and tactical expansion.",
      bucketKeys: ["growth", "swing"],
      subclassKeys: [
        "defi_growth_yield",
        "realfi10",
        "genesis10",
        "geoedge",
        "digital_reserve",
        "gold_silver_reserve",
        "nova10",
      ],
    },
  };
}

function resolveTierKey(bucketKey, subclassKey, yieldProfile) {
  const bucket = normalize(bucketKey);
  const subclass = normalize(subclassKey);
  const profile = normalize(yieldProfile);

  if (
    bucket === "stable_core" ||
    subclass.includes("stable") ||
    profile.includes("stable")
  ) {
    return "tier_0";
  }

  if (
    bucket === "rotational_core" ||
    subclass.includes("hayp") ||
    subclass.includes("hard_asset") ||
    subclass.includes("collateral") ||
    subclass.includes("real_estate")
  ) {
    return "tier_1";
  }

  return "tier_2";
}

function resolveBucketKey(wallet, walletHoldings) {
  const explicitWalletBucket = normalize(wallet?.default_mmii_bucket);
  if (explicitWalletBucket) return explicitWalletBucket;

  const bucketTotals = new Map();

  for (const holding of walletHoldings) {
    const bucket = normalize(holding.mmii_bucket);
    if (!bucket) continue;

    const next =
      safeNumber(bucketTotals.get(bucket)) + safeNumber(holding.value_usd);
    bucketTotals.set(bucket, next);
  }

  if (bucketTotals.size) {
    return [...bucketTotals.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const role = normalize(getWalletRole(wallet));
  const name = normalize(getWalletDisplayName(wallet));

  if (
    role.includes("swing") ||
    role.includes("trading") ||
    name.includes("swing") ||
    name.includes("trading")
  ) {
    return "swing";
  }

  if (
    role.includes("yield") ||
    name.includes("yield") ||
    role.includes("reserve") ||
    name.includes("reserve")
  ) {
    return "stable_core";
  }

  if (role.includes("core") || role.includes("vault")) {
    return "rotational_core";
  }

  return "growth";
}

function serializeWallet(wallet, snapshot, bucketKey, tierKey) {
  return {
    wallet_id: getWalletId(wallet),
    wallet_name: getWalletDisplayName(wallet),
    wallet_address: getWalletAddress(wallet),
    wallet_address_short: truncateAddress(getWalletAddress(wallet)),
    role: getWalletRole(wallet),
    wallet_type: getWalletType(wallet),
    network_group: getWalletNetworkGroup(wallet),
    status: getWalletStatus(wallet),
    bucket_key: bucketKey,
    bucket_label: formatLabel(bucketKey),
    tier_key: tierKey,
    total_value_usd: getSnapshotValue(snapshot),
    snapshot_time: snapshot?.snapshot_time || null,
  };
}

function computeAllocation(value, total) {
  if (total <= 0) return 0;
  return (safeNumber(value) / total) * 100;
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

function buildSubclassNodes(bucketHoldings, totalPortfolioValue) {
  const grouped = new Map();

  for (const holding of bucketHoldings) {
    const subclassKey =
      normalize(holding.mmii_subclass) ||
      normalize(holding.yield_profile) ||
      "unclassified";

    if (!grouped.has(subclassKey)) {
      grouped.set(subclassKey, {
        total_value_usd: 0,
        holding_count: 0,
        examples: [],
      });
    }

    const current = grouped.get(subclassKey);
    current.total_value_usd += safeNumber(holding.value_usd);
    current.holding_count += 1;

    if (current.examples.length < 4) {
      current.examples.push({
        asset_id: safeString(holding.asset_id),
        token_symbol: safeString(holding.token_symbol || holding.asset_symbol) || "Unknown",
        value_usd: safeNumber(holding.value_usd),
        yield_profile: safeString(holding.yield_profile) || "none",
      });
    }
  }

  return [...grouped.entries()]
    .map(([subclassKey, data]) =>
      createNode({
        key: subclassKey,
        label: formatLabel(subclassKey),
        type: "subclass",
        description: `Subclass grouping derived from mmii_subclass / yield_profile.`,
        total_value_usd: data.total_value_usd,
        allocation_pct: computeAllocation(data.total_value_usd, totalPortfolioValue),
        holding_count: data.holding_count,
        children: [],
        wallets: [],
        meta: {
          examples: data.examples,
        },
      })
    )
    .sort((a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [walletsResult, snapshotsResult, holdingsResult] = await Promise.all([
      fetchWalletsWithFallback(),
      supabase
        .from("wallet_snapshots")
        .select("*")
        .order("snapshot_time", { ascending: false }),
      supabase
        .from("wallet_holdings")
        .select("*")
        .order("snapshot_time", { ascending: false }),
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
      if (holding.snapshot_id && latestSnapshotIds.size && !latestSnapshotIds.has(holding.snapshot_id)) {
        continue;
      }

      const walletId = holding.wallet_id || null;
      if (!walletId) continue;

      if (!holdingsByWalletId.has(walletId)) {
        holdingsByWalletId.set(walletId, []);
      }

      holdingsByWalletId.get(walletId).push(holding);
    }

    const tierDefinitions = getTierDefinition();

    const tierAccumulators = {
      tier_0: {
        ...tierDefinitions.tier_0,
        total_value_usd: 0,
        wallet_count: 0,
        holding_count: 0,
        buckets: new Map(),
      },
      tier_1: {
        ...tierDefinitions.tier_1,
        total_value_usd: 0,
        wallet_count: 0,
        holding_count: 0,
        buckets: new Map(),
      },
      tier_2: {
        ...tierDefinitions.tier_2,
        total_value_usd: 0,
        wallet_count: 0,
        holding_count: 0,
        buckets: new Map(),
      },
    };

    let totalPortfolioValue = 0;
    let trackedWalletCount = 0;

    for (const wallet of wallets) {
      const walletId = getWalletId(wallet);
      if (!walletId) continue;

      const latestSnapshot = latestSnapshotsByWalletId.get(walletId) || null;
      const walletHoldings = holdingsByWalletId.get(walletId) || [];
      const walletValue = getSnapshotValue(latestSnapshot);
      const bucketKey = resolveBucketKey(wallet, walletHoldings);

      const dominantSubclassHolding = [...walletHoldings].sort(
        (a, b) => safeNumber(b.value_usd) - safeNumber(a.value_usd)
      )[0];

      const tierKey = resolveTierKey(
        bucketKey,
        dominantSubclassHolding?.mmii_subclass,
        dominantSubclassHolding?.yield_profile
      );

      totalPortfolioValue += walletValue;
      trackedWalletCount += 1;

      const tier = tierAccumulators[tierKey];
      tier.total_value_usd += walletValue;
      tier.wallet_count += 1;
      tier.holding_count += walletHoldings.length;

      if (!tier.buckets.has(bucketKey)) {
        tier.buckets.set(bucketKey, {
          key: bucketKey,
          label: formatLabel(bucketKey),
          description: `MMII bucket grouping for ${formatLabel(bucketKey)}.`,
          total_value_usd: 0,
          wallet_count: 0,
          holding_count: 0,
          wallets: [],
          holdings: [],
        });
      }

      const bucket = tier.buckets.get(bucketKey);
      bucket.total_value_usd += walletValue;
      bucket.wallet_count += 1;
      bucket.holding_count += walletHoldings.length;
      bucket.wallets.push(serializeWallet(wallet, latestSnapshot, bucketKey, tierKey));
      bucket.holdings.push(...walletHoldings);
    }

    const tiers = Object.values(tierAccumulators).map((tier) => {
      const bucketNodes = [...tier.buckets.values()]
        .map((bucket) => {
          const subclassNodes = buildSubclassNodes(bucket.holdings, totalPortfolioValue);

          return createNode({
            key: bucket.key,
            label: bucket.label,
            type: "bucket",
            description: bucket.description,
            total_value_usd: bucket.total_value_usd,
            allocation_pct: computeAllocation(bucket.total_value_usd, totalPortfolioValue),
            wallet_count: bucket.wallet_count,
            holding_count: bucket.holding_count,
            children: subclassNodes,
            wallets: bucket.wallets.sort(
              (a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd)
            ),
            meta: {},
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
        children: bucketNodes,
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
        "Top-level MMII structural map showing how portfolio capital is organized through foundational tiers and strategic sleeves.",
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
        mapping_type: "tier_bucket_subclass_first_pass",
        note: "Structure is currently derived from wallet metadata plus latest wallet_holdings classification fields such as mmii_bucket, mmii_subclass, and yield_profile.",
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