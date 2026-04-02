const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  return normalizeText(value);
}

function isBlockchainRole(role) {
  const normalized = normalizeRole(role);

  return [
    "hub",
    "yield",
    "core",
    "swing",
    "external",
    "trading",
  ].includes(normalized);
}

function getLatestPerWallet(snapshots) {
  const latestPerWallet = new Map();

  for (const snapshot of snapshots || []) {
    const existing = latestPerWallet.get(snapshot.wallet_id);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWallet.set(snapshot.wallet_id, snapshot);
    }
  }

  return Array.from(latestPerWallet.values());
}

module.exports = async function handler(req, res) {
  try {
    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, role, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const blockchainWallets = activeWallets.filter((wallet) =>
      isBlockchainRole(wallet.role)
    );

    if (blockchainWallets.length === 0) {
      return res.status(200).json({
        total_blockchain_value: 0,
        yield_contribution: 0,
        active_accounts: 0,
        chains_covered: 0,
      });
    }

    const walletIds = blockchainWallets.map((wallet) => wallet.id);

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(`
        id,
        wallet_id,
        total_value_usd,
        total_claimable_usd,
        snapshot_time
      `)
      .in("wallet_id", walletIds)
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) throw snapshotsError;

    const latestSnapshots = getLatestPerWallet(snapshots || []);
    const latestSnapshotIds = latestSnapshots.map((snapshot) => snapshot.id);

    let holdings = [];

    if (latestSnapshotIds.length > 0) {
      const { data: holdingsData, error: holdingsError } = await supabase
        .from("wallet_holdings")
        .select("snapshot_id, network")
        .in("snapshot_id", latestSnapshotIds);

      if (holdingsError) throw holdingsError;

      holdings = Array.isArray(holdingsData) ? holdingsData : [];
    }

    const totalBlockchainValue = latestSnapshots.reduce(
      (sum, snapshot) => sum + safeNumber(snapshot.total_value_usd),
      0
    );

    const yieldContribution = latestSnapshots.reduce(
      (sum, snapshot) => sum + safeNumber(snapshot.total_claimable_usd),
      0
    );

    const uniqueChains = new Set(
      holdings
        .map((holding) => normalizeText(holding.network))
        .filter(Boolean)
    );

    return res.status(200).json({
      total_blockchain_value: totalBlockchainValue,
      yield_contribution: yieldContribution,
      active_accounts: blockchainWallets.length,
      chains_covered: uniqueChains.size,
    });
  } catch (err) {
    console.error("[api/blockchain-accounts-summary] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};