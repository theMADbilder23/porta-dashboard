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

function getWalletDisplayName(wallet) {
  return (
    safeString(wallet.wallet_name) ||
    safeString(wallet.name) ||
    safeString(wallet.label) ||
    "Unnamed Wallet"
  );
}

function getWalletAddress(wallet) {
  return (
    safeString(wallet.wallet_address) ||
    safeString(wallet.address) ||
    null
  );
}

function getWalletRole(wallet) {
  return (
    safeString(wallet.role) ||
    safeString(wallet.wallet_role) ||
    "Unassigned"
  );
}

function getWalletNetworkGroup(wallet) {
  return (
    safeString(wallet.network_group) ||
    safeString(wallet.chain_group) ||
    "Unknown"
  );
}

function getWalletType(wallet) {
  return (
    safeString(wallet.wallet_type) ||
    safeString(wallet.account_type) ||
    "Unknown"
  );
}

function getWalletStatus(wallet) {
  if (wallet?.is_active === false) return "Inactive";
  return "Active";
}

function getSnapshotValue(snapshot) {
  if (!snapshot) return 0;

  return (
    safeNumber(snapshot.total_value_usd) +
    safeNumber(snapshot.total_pending_usd)
  );
}

function getLatestSnapshotTime(snapshot) {
  return snapshot?.snapshot_time || null;
}

function getBucketLabel(branchKey) {
  switch (branchKey) {
    case "stable_core":
      return "Stable Core";
    case "rotational_core":
      return "Rotational Core";
    case "growth":
      return "Growth";
    case "swing":
      return "Swing";
    default:
      return "Unassigned";
  }
}

function getBranchDescription(branchKey) {
  switch (branchKey) {
    case "stable_core":
      return "Capital preservation and stable-yield structure.";
    case "rotational_core":
      return "Rotational deployment layer for strategic capital shifts.";
    case "growth":
      return "High-upside positions and asymmetric opportunity layer.";
    case "swing":
      return "Active trading and tactical liquidity generation layer.";
    default:
      return "Unclassified MMII structure branch.";
  }
}

/**
 * FIRST-PASS MMII STRUCTURE MAPPING
 *
 * This is intentionally conservative and heuristic-based.
 * We can tighten it later as explicit wallet->branch metadata is added.
 */
function mapWalletToBranch(wallet) {
  const role = normalize(getWalletRole(wallet));
  const name = normalize(getWalletDisplayName(wallet));
  const type = normalize(getWalletType(wallet));
  const networkGroup = normalize(getWalletNetworkGroup(wallet));

  // Explicit swing / trading layer
  if (
    role.includes("swing") ||
    role.includes("trading") ||
    name.includes("swing") ||
    name.includes("trading")
  ) {
    return "swing";
  }

  // Stable core / yield vault logic
  if (
    role.includes("yield") ||
    name.includes("yield vault") ||
    name.includes("stable") ||
    name.includes("reserve") ||
    role.includes("reserve")
  ) {
    return "stable_core";
  }

  // Core / multisig / brokerage / hard-asset style = rotational core (for now)
  if (
    role.includes("core") ||
    role.includes("vault") ||
    type.includes("brokerage") ||
    type.includes("bank") ||
    networkGroup.includes("brokerage") ||
    networkGroup.includes("traditional")
  ) {
    return "rotational_core";
  }

  // Hub / defi / onchain operational wallet = growth layer
  if (
    role.includes("hub") ||
    name.includes("hub") ||
    networkGroup.includes("blockchain") ||
    networkGroup.includes("multi-chain") ||
    networkGroup.includes("multichain") ||
    networkGroup.includes("base") ||
    networkGroup.includes("defi")
  ) {
    return "growth";
  }

  // Default fallback
  return "growth";
}

function buildEmptyBranch(key) {
  return {
    key,
    label: getBucketLabel(key),
    description: getBranchDescription(key),
    total_value_usd: 0,
    allocation_pct: 0,
    wallet_count: 0,
    wallets: [],
  };
}

function computeAlignmentScore(branches, totalPortfolioValue) {
  if (totalPortfolioValue <= 0) return 0;

  const stable = safeNumber(branches.stable_core?.allocation_pct);
  const rotational = safeNumber(branches.rotational_core?.allocation_pct);
  const growth = safeNumber(branches.growth?.allocation_pct);
  const swing = safeNumber(branches.swing?.allocation_pct);

  /**
   * Transitional logic for now:
   * Stable highest priority, Rotational second, Growth third, Swing lowest
   *
   * Weighted ideal:
   * Stable      40
   * Rotational  30
   * Growth      20
   * Swing       10
   */
  const target = {
    stable_core: 40,
    rotational_core: 30,
    growth: 20,
    swing: 10,
  };

  const deviation =
    Math.abs(stable - target.stable_core) +
    Math.abs(rotational - target.rotational_core) +
    Math.abs(growth - target.growth) +
    Math.abs(swing - target.swing);

  const score = Math.max(0, 100 - deviation);
  return Math.round(score);
}

function getDominantBranch(branches) {
  const values = Object.values(branches);

  if (!values.length) return "Unassigned";

  const sorted = [...values].sort(
    (a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd)
  );

  return sorted[0]?.label || "Unassigned";
}

function serializeWalletForBranch(wallet, snapshot, branchKey, totalPortfolioValue) {
  const totalValue = getSnapshotValue(snapshot);
  const allocationPct =
    totalPortfolioValue > 0 ? (totalValue / totalPortfolioValue) * 100 : 0;

  return {
    wallet_id: wallet.wallet_id || wallet.id || null,
    wallet_name: getWalletDisplayName(wallet),
    wallet_address: getWalletAddress(wallet),
    wallet_address_short: truncateAddress(getWalletAddress(wallet)),
    role: getWalletRole(wallet),
    wallet_type: getWalletType(wallet),
    network_group: getWalletNetworkGroup(wallet),
    status: getWalletStatus(wallet),
    branch_key: branchKey,
    branch_label: getBucketLabel(branchKey),
    total_value_usd: totalValue,
    allocation_pct: allocationPct,
    snapshot_time: getLatestSnapshotTime(snapshot),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [walletsResult, snapshotsResult] = await Promise.all([
      supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: true }),

      supabase
        .from("wallet_snapshots")
        .select("*")
        .order("snapshot_time", { ascending: false }),
    ]);

    if (walletsResult.error) {
      console.error("[strategy-flow] wallets fetch error", walletsResult.error);
      return res.status(500).json({ error: "Failed to load wallets" });
    }

    if (snapshotsResult.error) {
      console.error("[strategy-flow] snapshots fetch error", snapshotsResult.error);
      return res.status(500).json({ error: "Failed to load wallet snapshots" });
    }

    const wallets = Array.isArray(walletsResult.data) ? walletsResult.data : [];
    const snapshots = Array.isArray(snapshotsResult.data) ? snapshotsResult.data : [];

    // Latest snapshot per wallet
    const latestSnapshotsByWalletId = new Map();

    for (const snapshot of snapshots) {
      const walletId = snapshot.wallet_id;
      if (!walletId) continue;

      if (!latestSnapshotsByWalletId.has(walletId)) {
        latestSnapshotsByWalletId.set(walletId, snapshot);
      }
    }

    const branches = {
      stable_core: buildEmptyBranch("stable_core"),
      rotational_core: buildEmptyBranch("rotational_core"),
      growth: buildEmptyBranch("growth"),
      swing: buildEmptyBranch("swing"),
    };

    let totalPortfolioValue = 0;
    let trackedWalletCount = 0;

    for (const wallet of wallets) {
      const walletId = wallet.wallet_id || wallet.id || null;
      if (!walletId) continue;

      const latestSnapshot = latestSnapshotsByWalletId.get(walletId) || null;
      const branchKey = mapWalletToBranch(wallet);
      const walletValue = getSnapshotValue(latestSnapshot);

      totalPortfolioValue += walletValue;
      trackedWalletCount += 1;

      branches[branchKey].wallets.push(
        serializeWalletForBranch(wallet, latestSnapshot, branchKey, 0)
      );
      branches[branchKey].wallet_count += 1;
      branches[branchKey].total_value_usd += walletValue;
    }

    // Now that total value is known, finalize allocation %
    Object.values(branches).forEach((branch) => {
      branch.allocation_pct =
        totalPortfolioValue > 0
          ? (safeNumber(branch.total_value_usd) / totalPortfolioValue) * 100
          : 0;

      branch.wallets = branch.wallets
        .map((wallet) => ({
          ...wallet,
          allocation_pct:
            totalPortfolioValue > 0
              ? (safeNumber(wallet.total_value_usd) / totalPortfolioValue) * 100
              : 0,
        }))
        .sort((a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd));
    });

    const alignmentScore = computeAlignmentScore(branches, totalPortfolioValue);
    const dominantBranch = getDominantBranch(branches);

    return res.status(200).json({
      summary: {
        total_branches: 4,
        tracked_wallets: trackedWalletCount,
        total_portfolio_value: totalPortfolioValue,
        alignment_score: alignmentScore,
        dominant_branch: dominantBranch,
      },
      branches: [
        branches.stable_core,
        branches.rotational_core,
        branches.growth,
        branches.swing,
      ],
      methodology: {
        mapping_type: "heuristic_first_pass",
        note: "Wallets are currently mapped into MMII branches using wallet role, name, wallet type, and network-group heuristics. This can later be replaced with explicit wallet-to-branch metadata.",
      },
    });
  } catch (error) {
    console.error("[strategy-flow] unexpected error", error);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}