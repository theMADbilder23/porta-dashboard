import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

const DEBANK_API_KEY = process.env.DEBANK_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEBANK_BASE = "https://pro-openapi.debank.com/v1";
const MERKL_BASE = "https://api.merkl.xyz/v4";
const POLL_INTERVAL_MS = 30 * 60 * 1000;

const STKWELL_CONTRACT = "0xe66E3A37C3274Ac24FE8590f7D84A2427194DC17";
const BASE_CHAIN_ID = 8453;

if (!DEBANK_API_KEY) throw new Error("Missing DEBANK_API_KEY");
if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const baseClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const SAFE_SYMBOL_ALLOWLIST = new Set([
  "ETH",
  "WETH",
  "USDC",
  "USDT",
  "DAI",
  "WBTC",
  "WELL",
  "stkWELL",
  "MAMO",
  "AERO",
  "cbBTC",
]);

function cleanWallet(wallet) {
  return String(wallet || "").trim().replace(/</g, "").replace(/>/g, "");
}

function isValidWallet(wallet) {
  return wallet.startsWith("0x") && wallet.length === 42;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function looksLikeSpamSymbol(symbol) {
  if (!symbol) return true;

  const s = String(symbol).trim();
  const lower = s.toLowerCase();

  if (s.includes(".")) return true;

  const spamPatterns = [
    "http",
    "www",
    "claim",
    "airdrop",
    "visit",
    "swap",
    "bonus",
    "gift",
    "reward",
    "free",
    "air",
  ];

  if (spamPatterns.some((p) => lower.includes(p))) return true;
  if (s.length > 12) return true;
  if (!/^[A-Za-z0-9\\-_]+$/.test(s)) return true;

  return false;
}

function isTokenTrusted(symbol) {
  if (!symbol) return false;
  return SAFE_SYMBOL_ALLOWLIST.has(symbol);
}

function getTopTokens(tokenData, walletTotalValue, roleUsed, limit = 5, minUsd = 25) {
  if (!Array.isArray(tokenData)) return [];

  const cleaned = [];
  const normalizedRole = String(roleUsed || "").toLowerCase();
  const isStrictRole =
    normalizedRole === "hub" ||
    normalizedRole === "trading" ||
    normalizedRole === "swing";

  for (const token of tokenData) {
    const symbol = token?.optimized_symbol || token?.symbol || "";
    const tokenName = token?.name || symbol || "Unknown";
    const amount = safeNumber(token?.amount || 0);
    const price = safeNumber(token?.price || 0);
    const value = safeNumber(token?.usd_value ?? price * amount ?? 0);
    const trusted = isTokenTrusted(symbol);

    if (
      (normalizedRole === "hub" ||
        normalizedRole === "trading" ||
        normalizedRole === "swing") &&
      !trusted
    ) {
      continue;
    }

    if (value < minUsd && !trusted) continue;
    if (looksLikeSpamSymbol(symbol) && !trusted) continue;

    if (walletTotalValue > 0 && value > walletTotalValue && !trusted) {
      continue;
    }

    if (isStrictRole && !trusted) {
      if (walletTotalValue > 0 && value > walletTotalValue) continue;
    }

    cleaned.push({
      token_symbol: symbol,
      token_name: tokenName,
      network: token?.chain || "Unknown",
      amount,
      value_usd: value,
      category: "wallet",
      protocol: null,
      is_yield_position: false,
    });
  }

  cleaned.sort((a, b) => b.value_usd - a.value_usd);
  return cleaned.slice(0, limit);
}

function getTopProtocols(protocolData, limit = 5, minUsd = 25) {
  if (!Array.isArray(protocolData)) return [];

  const results = [];

  for (const protocol of protocolData) {
    const protocolName = protocol?.name || "Unknown";
    const protocolNetwork = protocol?.chain || "Unknown";

    if (protocolName === "Moonwell") {
      continue;
    }

    let totalValue = 0;
    let amountSymbol = null;
    let amountTokenName = null;
    let totalAmount = 0;

    for (const item of protocol?.portfolio_item_list || []) {
      const stats = item?.stats || {};
      const itemValue = safeNumber(
        stats?.net_usd_value ?? stats?.asset_usd_value ?? 0
      );
      totalValue += itemValue;

      const detailTypes = [
        "supply_token_list",
        "borrow_token_list",
        "reward_token_list",
        "deposit_token_list",
        "stake_token_list",
        "lock_token_list",
      ];

      for (const detailType of detailTypes) {
        const detailList = item?.detail?.[detailType] || [];

        for (const token of detailList) {
          const symbol = token?.optimized_symbol || token?.symbol || null;
          const amount = safeNumber(token?.amount || 0);

          if (amountSymbol === null && symbol) {
            amountSymbol = symbol;
            amountTokenName = symbol;
          }

          if (symbol === amountSymbol) {
            totalAmount += amount;
          }
        }
      }
    }

    if (totalValue >= minUsd) {
      results.push({
        protocol_name: protocolName,
        token_symbol: amountSymbol,
        token_name: amountTokenName,
        network: protocolNetwork,
        amount: totalAmount,
        value_usd: totalValue,
        category: "protocol",
        protocol: protocolName,
        is_yield_position: true,
      });
    }
  }

  results.sort((a, b) => b.value_usd - a.value_usd);
  return results.slice(0, limit);
}

async function debankGet(endpoint, wallet) {
  const url = new URL(`${DEBANK_BASE}${endpoint}`);
  url.searchParams.set("id", wallet);

  const res = await fetch(url.toString(), {
    headers: {
      AccessKey: DEBANK_API_KEY,
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeBank ${res.status}: ${text}`);
  }

  return res.json();
}

async function fetchWallets() {
  const { data, error } = await supabase
    .from("Wallets")
    .select("id, name, role, wallet_address, network_group, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch Wallets: ${error.message}`);
  }

  return data || [];
}

async function getStkWellBalance(walletAddress) {
  try {
    const raw = await baseClient.readContract({
      address: STKWELL_CONTRACT,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    return safeNumber(formatUnits(raw, 18));
  } catch (err) {
    console.error(`[collector] stkWELL balance lookup failed for ${walletAddress}`, err);
    return 0;
  }
}

async function getMerklWellRewards(walletAddress) {
  try {
    const url = new URL(`${MERKL_BASE}/users/${walletAddress}/rewards`);
    url.searchParams.set("chainId", String(BASE_CHAIN_ID));
    url.searchParams.set("claimableOnly", "false");
    url.searchParams.set("type", "TOKEN");
    url.searchParams.set("breakdownPage", "0");

    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Merkl ${res.status}: ${text}`);
    }

    const data = await res.json();

    if (
      !Array.isArray(data) ||
      !data.length ||
      !Array.isArray(data[0]?.rewards) ||
      !data[0].rewards.length
    ) {
      return {
        earned: 0,
        claimed: 0,
        pending: 0,
        claimable: 0,
        price: 0,
        usd_value: 0,
        token: "WELL",
        raw: data,
      };
    }

    const reward = data[0].rewards[0];
    const decimals = safeNumber(reward?.token?.decimals || 18);
    const price = safeNumber(reward?.token?.price || 0);

    const earned = safeNumber(reward?.amount || 0) / 10 ** decimals;
    const claimed = safeNumber(reward?.claimed || 0) / 10 ** decimals;
    const pending = safeNumber(reward?.pending || 0) / 10 ** decimals;
    const claimable = Math.max(0, earned - claimed - pending);
    const usdValue = claimable * price;

    return {
      earned,
      claimed,
      pending,
      claimable,
      price,
      usd_value: usdValue,
      token: reward?.token?.symbol || "WELL",
      raw: data,
    };
  } catch (err) {
    console.error(`[collector] Merkl rewards lookup failed for ${walletAddress}`, err);
    return {
      earned: 0,
      claimed: 0,
      pending: 0,
      claimable: 0,
      price: 0,
      usd_value: 0,
      token: "WELL",
      raw: null,
    };
  }
}

function buildStkWellHolding(stakedAmount, wellPrice, snapshotTime) {
  if (!stakedAmount || stakedAmount <= 0) return null;

  return {
    token_symbol: "stkWELL",
    token_name: "stkWELL",
    network: "base",
    amount: stakedAmount,
    value_usd: stakedAmount * wellPrice,
    category: "protocol",
    protocol: "Moonwell",
    is_yield_position: true,
    snapshot_time: snapshotTime,
  };
}

function buildSnapshotMetrics(merklRewards) {
  const price = safeNumber(merklRewards?.price || 0);
  const earned = safeNumber(merklRewards?.earned || 0);
  const claimed = safeNumber(merklRewards?.claimed || 0);
  const pending = safeNumber(merklRewards?.pending || 0);
  const claimable = safeNumber(merklRewards?.claimable || 0);

  return {
    total_rewards_usd: earned * price,
    total_claimed_usd: claimed * price,
    total_pending_usd: pending * price,
    total_claimable_usd: claimable * price,
    total_claimable_token: claimable,
    rewards_token_symbol: merklRewards?.token || null,
    merkl_rewards_json: merklRewards?.raw || null,
  };
}

async function insertSnapshot(
  wallet,
  totalValueUsd,
  merklMetrics,
  snapshotTime
) {
  const payload = {
    wallet_id: wallet.id,
    total_value_usd: safeNumber(totalValueUsd),
    total_rewards_usd: safeNumber(merklMetrics.total_rewards_usd),
    total_claimed_usd: safeNumber(merklMetrics.total_claimed_usd),
    total_pending_usd: safeNumber(merklMetrics.total_pending_usd),
    total_claimable_usd: safeNumber(merklMetrics.total_claimable_usd),
    total_claimable_token: safeNumber(merklMetrics.total_claimable_token),
    rewards_token_symbol: merklMetrics.rewards_token_symbol || null,
    merkl_rewards_json: merklMetrics.merkl_rewards_json || null,
    snapshot_time: snapshotTime,
  };

  const { data, error } = await supabase
    .from("wallet_snapshots")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Failed to insert snapshot for ${wallet.wallet_address}: ${error.message}`
    );
  }

  return data;
}

async function insertHoldings(wallet, snapshotId, snapshotTime, holdings) {
  if (!holdings.length) return;

  const rows = holdings.map((holding) => ({
    snapshot_id: snapshotId,
    wallet_id: wallet.id,
    token_symbol: holding.token_symbol,
    token_name: holding.token_name,
    network: holding.network,
    amount: holding.amount,
    value_usd: holding.value_usd,
    category: holding.category,
    protocol: holding.protocol,
    is_yield_position: holding.is_yield_position,
    snapshot_time: snapshotTime,
  }));

  const { error } = await supabase.from("wallet_holdings").insert(rows);

  if (error) {
    throw new Error(
      `Failed to insert holdings for ${wallet.wallet_address}: ${error.message}`
    );
  }
}

async function collectOneWallet(wallet) {
  const cleanedAddress = cleanWallet(wallet.wallet_address);

  if (!isValidWallet(cleanedAddress)) {
    console.warn(
      `[collector] Skipping invalid wallet: ${wallet.name || "Unnamed"} (${wallet.wallet_address})`
    );
    return;
  }

  const snapshotTime = new Date().toISOString();

  const [totalBalance, usedChains, allTokens, allProtocols, merklRewards, stkWellAmount] =
    await Promise.all([
      debankGet("/user/total_balance", cleanedAddress),
      debankGet("/user/used_chain_list", cleanedAddress),
      debankGet("/user/all_token_list?is_all=false", cleanedAddress),
      debankGet("/user/all_complex_protocol_list", cleanedAddress),
      getMerklWellRewards(cleanedAddress),
      getStkWellBalance(cleanedAddress),
    ]);

  const totalWalletValue = safeNumber(totalBalance?.total_usd_value || 0);
  const chainCount = Array.isArray(usedChains) ? usedChains.length : 0;
  const roleUsed = wallet.role || "core";

  const topTokens = getTopTokens(
    Array.isArray(allTokens) ? allTokens : [],
    totalWalletValue,
    roleUsed,
    5,
    25
  );

  const topProtocols = getTopProtocols(
    Array.isArray(allProtocols) ? allProtocols : [],
    5,
    25
  );

  const stkWellHolding = buildStkWellHolding(
    stkWellAmount,
    safeNumber(merklRewards?.price || 0),
    snapshotTime
  );

  const merklMetrics = buildSnapshotMetrics(merklRewards);

  const snapshot = await insertSnapshot(
    wallet,
    totalWalletValue,
    merklMetrics,
    snapshotTime
  );

  const allHoldings = [
    ...topTokens,
    ...topProtocols,
    ...(stkWellHolding ? [stkWellHolding] : []),
  ];

  await insertHoldings(wallet, snapshot.id, snapshotTime, allHoldings);

  console.log(
    JSON.stringify(
      {
        wallet_name: wallet.name || null,
        wallet_address: cleanedAddress,
        role_used: roleUsed,
        total_value_usd: totalWalletValue,
        chain_count: chainCount,
        snapshot_id: snapshot.id,
        snapshot_metrics: {
          total_rewards_usd: merklMetrics.total_rewards_usd,
          total_claimed_usd: merklMetrics.total_claimed_usd,
          total_pending_usd: merklMetrics.total_pending_usd,
          total_claimable_usd: merklMetrics.total_claimable_usd,
          total_claimable_token: merklMetrics.total_claimable_token,
          rewards_token_symbol: merklMetrics.rewards_token_symbol,
        },
        merkl_rewards: {
          token: merklRewards.token,
          price: merklRewards.price,
          earned: merklRewards.earned,
          claimed: merklRewards.claimed,
          pending: merklRewards.pending,
          claimable: merklRewards.claimable,
          usd_value: merklRewards.usd_value,
        },
        stkwell_balance: stkWellAmount,
        top_tokens: topTokens,
        top_protocols: topProtocols,
        enriched_holdings: stkWellHolding ? [stkWellHolding] : [],
      },
      null,
      2
    )
  );
}

async function runCollector() {
  console.log(`[collector] Run started at ${new Date().toISOString()}`);

  try {
    const wallets = await fetchWallets();

    if (!wallets.length) {
      console.warn("[collector] No active wallets found in Wallets table.");
      return;
    }

    for (const wallet of wallets) {
      try {
        await collectOneWallet(wallet);
      } catch (err) {
        console.error(
          `[collector] Wallet failed: ${wallet.name || "Unnamed"} (${wallet.wallet_address})`,
          err
        );
      }
    }

    console.log(`[collector] Run finished at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[collector] Fatal run error:", err);
  }
}

runCollector();
setInterval(runCollector, POLL_INTERVAL_MS);