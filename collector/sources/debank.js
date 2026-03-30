import { DEBANK_API_KEY, DEBANK_BASE } from "../config.js";
import { safeNumber } from "../utils.js";

if (!DEBANK_API_KEY) throw new Error("Missing DEBANK_API_KEY");

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
  if (!/^[A-Za-z0-9\-_]+$/.test(s)) return true;

  return false;
}

function isTokenTrusted(symbol) {
  if (!symbol) return false;
  return SAFE_SYMBOL_ALLOWLIST.has(symbol);
}

export async function debankGet(endpoint, wallet) {
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

export async function collectDebankData(walletAddress) {
  const [totalBalance, usedChains, allTokens, allProtocols] = await Promise.all([
    debankGet("/user/total_balance", walletAddress),
    debankGet("/user/used_chain_list", walletAddress),
    debankGet("/user/all_token_list?is_all=false", walletAddress),
    debankGet("/user/all_complex_protocol_list", walletAddress),
  ]);

  return {
    totalBalance,
    usedChains: Array.isArray(usedChains) ? usedChains : [],
    allTokens: Array.isArray(allTokens) ? allTokens : [],
    allProtocols: Array.isArray(allProtocols) ? allProtocols : [],
    totalWalletValue: safeNumber(totalBalance?.total_usd_value || 0),
  };
}

export function getTopTokens(tokenData, walletTotalValue, roleUsed, limit = 5, minUsd = 25) {
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

    if (isStrictRole && !trusted) continue;
    if (value < minUsd && !trusted) continue;
    if (looksLikeSpamSymbol(symbol) && !trusted) continue;
    if (walletTotalValue > 0 && value > walletTotalValue && !trusted) continue;

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

export function getTopProtocols(protocolData, limit = 5, minUsd = 25) {
  if (!Array.isArray(protocolData)) return [];

  const results = [];

  for (const protocol of protocolData) {
    const protocolName = protocol?.name || "Unknown";
    const protocolNetwork = protocol?.chain || "Unknown";

    if (protocolName === "Moonwell") continue;

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