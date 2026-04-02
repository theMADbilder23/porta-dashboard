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

function formatRoleLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatChainLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "Unknown";
  if (normalized === "eth") return "Ethereum";
  if (normalized === "op") return "Optimism";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

function isExplicitNonBlockchainWallet(wallet) {
  const role = normalizeText(wallet?.role);
  const networkGroup = normalizeText(wallet?.network_group);
  const name = normalizeText(wallet?.name);

  const excludedValues = new Set([
    "banking",
    "bank",
    "investment",
    "brokerage",
    "traditional",
  ]);

  return (
    excludedValues.has(role) ||
    excludedValues.has(networkGroup) ||
    name.includes("bank") ||
    name.includes("brokerage") ||
    name.includes("investment account")
  );
}

function isRealChain(value) {
  const network = normalizeText(value);

  if (!network) return false;

  const invalidValues = new Set([
    "null",
    "undefined",
    "unknown",
    "n/a",
    "na",
    "multi-chain",
    "multichain",
    "multi chain",
  ]);

  return !invalidValues.has(network);
}

module.exports = async function handler(req, res) {
  try {
    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, name, role, network_group, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];

    const blockchainWallets = activeWallets.filter(
      (wallet) => !isExplicitNonBlockchainWallet(wallet)
    );

    if (blockchainWallets.length === 0) {
      return res.status(200).json({
        total_blockchain_value: 0,
        yield_contribution: 0,
        active_accounts: 0,
        chains_covered: 0,
        accounts: [],
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
        .select(`
          snapshot_id,
          wallet_id,
          token_symbol,
          token_name,
          network,
          value_usd
        `)
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

    const uniqueChains = new Set();

    for (const holding of holdings) {
      const network = normalizeText(holding.network);
      if (isRealChain(network)) {
        uniqueChains.add(network);
      }
    }

    for (const wallet of blockchainWallets) {
      const networkGroup = normalizeText(wallet.network_group);
      if (isRealChain(networkGroup)) {
        uniqueChains.add(networkGroup);
      }
    }

    const walletById = new Map(
      blockchainWallets.map((wallet) => [wallet.id, wallet])
    );

    const holdingsByWalletId = new Map();

    for (const holding of holdings) {
      const walletId = holding.wallet_id;
      if (!walletId) continue;

      if (!holdingsByWalletId.has(walletId)) {
        holdingsByWalletId.set(walletId, []);
      }

      holdingsByWalletId.get(walletId).push(holding);
    }

    const accounts = latestSnapshots
      .map((snapshot) => {
        const wallet = walletById.get(snapshot.wallet_id);
        const walletHoldings = holdingsByWalletId.get(snapshot.wallet_id) || [];

        const chainSet = new Set();

        for (const holding of walletHoldings) {
          const network = normalizeText(holding.network);
          if (isRealChain(network)) {
            chainSet.add(formatChainLabel(network));
          }
        }

        const normalizedNetworkGroup = normalizeText(wallet?.network_group);
        if (isRealChain(normalizedNetworkGroup)) {
          chainSet.add(formatChainLabel(normalizedNetworkGroup));
        }

        const totalValue = getPortfolioSnapshotValue(snapshot);
        const holdingsValueSum = walletHoldings.reduce(
          (sum, holding) => sum + safeNumber(holding.value_usd),
          0
        );

        return {
          wallet_id: snapshot.wallet_id,
          wallet_name: wallet?.name || "Unknown Wallet",
          role: formatRoleLabel(wallet?.role),
          network_group: wallet?.network_group || null,
          total_value: totalValue,
          yield_contribution: getClaimableSnapshotValue(snapshot),
          portfolio_share_pct:
            totalBlockchainValue > 0 ? (totalValue / totalBlockchainValue) * 100 : 0,
          snapshot_time: snapshot.snapshot_time || null,
          chains: Array.from(chainSet.values()),
          holdings_value_sum: holdingsValueSum,
          holdings_count: walletHoldings.length,
        };
      })
      .sort((a, b) => b.total_value - a.total_value);

    console.log("[api/blockchain-accounts-summary] final summary:", {
      total_blockchain_value: totalBlockchainValue,
      yield_contribution: yieldContribution,
      active_accounts: blockchainWallets.length,
      chains_covered: uniqueChains.size,
      account_values: accounts.map((account) => ({
        wallet_name: account.wallet_name,
        total_value: account.total_value,
        holdings_value_sum: account.holdings_value_sum,
        yield_contribution: account.yield_contribution,
        chains: account.chains,
      })),
    });

    return res.status(200).json({
      total_blockchain_value: totalBlockchainValue,
      yield_contribution: yieldContribution,
      active_accounts: blockchainWallets.length,
      chains_covered: uniqueChains.size,
      accounts,
    });
  } catch (err) {
    console.error("[api/blockchain-accounts-summary] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};