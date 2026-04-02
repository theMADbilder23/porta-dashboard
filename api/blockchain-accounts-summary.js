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

function normalizeNetwork(value) {
  return normalizeText(value);
}

function getPortfolioSnapshotValue(snapshot) {
  return (
    safeNumber(snapshot.total_value_usd) +
    safeNumber(snapshot.total_claimable_usd)
  );
}

function getClaimableSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_claimable_usd);
}

function buildLatestPerWallet(snapshots) {
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

function isBlockchainWallet(wallet) {
  const role = normalizeRole(wallet?.role);
  const networkGroup = normalizeNetwork(wallet?.network_group);

  const blockchainRoles = new Set([
    "hub",
    "yield",
    "core",
    "swing",
    "external",
    "trading",
  ]);

  const nonBlockchainGroups = new Set([
    "banking",
    "bank",
    "investment",
    "brokerage",
  ]);

  const knownBlockchainGroups = new Set([
    "base",
    "eth",
    "ethereum",
    "op",
    "optimism",
    "qubic",
    "sol",
    "solana",
    "arb",
    "arbitrum",
    "avax",
    "polygon",
    "bsc",
  ]);

  if (networkGroup && nonBlockchainGroups.has(networkGroup)) {
    return false;
  }

  if (networkGroup && knownBlockchainGroups.has(networkGroup)) {
    return true;
  }

  if (blockchainRoles.has(role)) {
    return true;
  }

  return false;
}

function isUsefulChain(value) {
  const network = normalizeNetwork(value);

  if (!network) return false;

  const invalid = new Set([
    "null",
    "undefined",
    "n/a",
    "na",
    "unknown",
  ]);

  return !invalid.has(network);
}

module.exports = async function handler(req, res) {
  try {
    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, name, role, network_group, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const blockchainWallets = activeWallets.filter(isBlockchainWallet);

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
        total_pending_usd,
        snapshot_time
      `)
      .in("wallet_id", walletIds)
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) throw snapshotsError;

    const latestSnapshots = buildLatestPerWallet(snapshots || []);
    const latestSnapshotIds = latestSnapshots.map((snapshot) => snapshot.id);

    let holdings = [];

    if (latestSnapshotIds.length > 0) {
      const { data: holdingsData, error: holdingsError } = await supabase
        .from("wallet_holdings")
        .select("snapshot_id, wallet_id, token_symbol, token_name, network, value_usd")
        .in("snapshot_id", latestSnapshotIds);

      if (holdingsError) throw holdingsError;

      holdings = Array.isArray(holdingsData) ? holdingsData : [];
    }

    const totalBlockchainValue = latestSnapshots.reduce(
      (sum, snapshot) => sum + getPortfolioSnapshotValue(snapshot),
      0
    );

    const yieldContribution = latestSnapshots.reduce(
      (sum, snapshot) => sum + getClaimableSnapshotValue(snapshot),
      0
    );

    const chainSet = new Set();

    for (const holding of holdings) {
      if (isUsefulChain(holding.network)) {
        chainSet.add(normalizeNetwork(holding.network));
      }
    }

    for (const wallet of blockchainWallets) {
      if (isUsefulChain(wallet.network_group)) {
        chainSet.add(normalizeNetwork(wallet.network_group));
      }
    }

    console.log("[api/blockchain-accounts-summary] wallets included:", 
      blockchainWallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        role: wallet.role,
        network_group: wallet.network_group,
      }))
    );

    console.log("[api/blockchain-accounts-summary] latest snapshots:", 
      latestSnapshots.map((snapshot) => ({
        wallet_id: snapshot.wallet_id,
        total_value_usd: safeNumber(snapshot.total_value_usd),
        total_claimable_usd: safeNumber(snapshot.total_claimable_usd),
        total_pending_usd: safeNumber(snapshot.total_pending_usd),
        snapshot_time: snapshot.snapshot_time,
        portfolio_value_used: getPortfolioSnapshotValue(snapshot),
      }))
    );

    console.log("[api/blockchain-accounts-summary] holdings networks:", 
      holdings.map((holding) => ({
        wallet_id: holding.wallet_id,
        snapshot_id: holding.snapshot_id,
        token_symbol: holding.token_symbol,
        network: holding.network,
        value_usd: safeNumber(holding.value_usd),
      }))
    );

    console.log("[api/blockchain-accounts-summary] summary result:", {
      total_blockchain_value: totalBlockchainValue,
      yield_contribution: yieldContribution,
      active_accounts: blockchainWallets.length,
      chains_covered: chainSet.size,
      chains: Array.from(chainSet.values()),
    });

    return res.status(200).json({
      total_blockchain_value: totalBlockchainValue,
      yield_contribution: yieldContribution,
      active_accounts: blockchainWallets.length,
      chains_covered: chainSet.size,
    });
  } catch (err) {
    console.error("[api/blockchain-accounts-summary] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};