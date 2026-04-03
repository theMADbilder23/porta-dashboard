import { createPublicClient, http, getAddress } from "viem";
import { base } from "viem/chains";

const BASE_RPC_URL = process.env.BASE_RPC_URL;

const client = createPublicClient({
  chain: base,
  transport: BASE_RPC_URL ? http(BASE_RPC_URL) : http(),
});

const DEBANK_API_KEY = process.env.DEBANK_API_KEY || "";

// This is the staking contract being read for principal + rewards
const MAMO_STAKING = getAddress("0x7855B0821401Ab078f6Cf457dEAFae775fF6c7A3");
const MAMO_STRATEGY = getAddress("0x51c5290167e933fdDB5B27A1690377dB05813FBa");

// Only this tracked wallet should emit the Mamo strategy rows
const MAMO_OWNER_WALLET = getAddress("0x1B6891DB50377c5bE23878c3C83564e5Df881b30");

const MAMO_TOKEN = getAddress("0x7300b37dfdfab110d83290a29dfb31b1740219fe");
const CBBTC_TOKEN = getAddress("0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf");

// Keep existing assumptions unless you later confirm different on-chain decimals
const MAMO_DECIMALS = 18;
const CBBTC_DECIMALS = 8;

const ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "earned",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "_rewardToken", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
];

function normalizeAddress(value) {
  if (!value || typeof value !== "string") return null;

  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatUnits(value, decimals) {
  return Number(value) / 10 ** decimals;
}

function getWalletAddress(wallet) {
  if (typeof wallet === "string") {
    return normalizeAddress(wallet);
  }

  return normalizeAddress(wallet?.wallet_address || wallet?.address || null);
}

async function fetchDebankTokenPrice(chainId, tokenId) {
  if (!DEBANK_API_KEY) return 0;

  try {
    const url = `https://pro-openapi.debank.com/v1/token?chain_id=${encodeURIComponent(
      chainId
    )}&id=${encodeURIComponent(tokenId)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        AccessKey: DEBANK_API_KEY,
      },
    });

    if (!response.ok) {
      console.warn("[mamo] debank token price request failed", {
        chainId,
        tokenId,
        status: response.status,
      });
      return 0;
    }

    const json = await response.json();
    return safeNumber(json?.price);
  } catch (error) {
    console.warn("[mamo] debank token price request error", {
      chainId,
      tokenId,
      message: error?.message || String(error),
    });
    return 0;
  }
}

function getLocalTokenPrices(context = {}) {
  const debankData = context.debankData || {};
  const allTokens = Array.isArray(debankData.allTokens)
    ? debankData.allTokens
    : [];

  const byAddress = new Map();
  const bySymbol = new Map();

  for (const token of allTokens) {
    const price = safeNumber(token?.price);
    if (price <= 0) continue;

    const symbol = String(token?.optimized_symbol || token?.symbol || "")
      .trim()
      .toUpperCase();

    const idAddress = normalizeAddress(token?.id);
    const tokenAddress =
      normalizeAddress(token?.address) || normalizeAddress(token?.token_address);

    if (idAddress && !byAddress.has(idAddress)) {
      byAddress.set(idAddress, price);
    }

    if (tokenAddress && !byAddress.has(tokenAddress)) {
      byAddress.set(tokenAddress, price);
    }

    if (symbol && !bySymbol.has(symbol)) {
      bySymbol.set(symbol, price);
    }
  }

  return { byAddress, bySymbol };
}

async function getPriceMap(context = {}) {
  const { byAddress, bySymbol } = getLocalTokenPrices(context);

  let mamoPrice =
    byAddress.get(MAMO_TOKEN) ||
    bySymbol.get("MAMO") ||
    0;

  let cbBtcPrice =
    byAddress.get(CBBTC_TOKEN) ||
    bySymbol.get("CBBTC") ||
    bySymbol.get("WBTC") ||
    bySymbol.get("BTC") ||
    0;

  if (!mamoPrice) {
    mamoPrice = await fetchDebankTokenPrice("base", MAMO_TOKEN);
  }

  if (!cbBtcPrice) {
    cbBtcPrice = await fetchDebankTokenPrice("base", CBBTC_TOKEN);
  }

  return {
    MAMO: safeNumber(mamoPrice),
    CBBTC: safeNumber(cbBtcPrice),
  };
}

export async function collectMamoProtocol(wallet, context = {}) {
  const walletAddress = getWalletAddress(wallet);

  if (!walletAddress) {
    console.warn("[mamo] invalid wallet address", { wallet });
    return [];
  }

  // Prevent duplicate insertion across multiple tracked wallets.
  // Only the owner wallet should emit this strategy's principal + rewards.
  if (walletAddress !== MAMO_OWNER_WALLET) {
    return [];
  }

  const snapshotTime = context.snapshotTime || new Date().toISOString();

  try {
    const prices = await getPriceMap(context);

    const [principalResult, mamoRewardResult, cbBtcRewardResult] =
      await Promise.allSettled([
        client.readContract({
          address: MAMO_STAKING,
          abi: ABI,
          functionName: "balanceOf",
          args: [MAMO_STRATEGY],
        }),
        client.readContract({
          address: MAMO_STAKING,
          abi: ABI,
          functionName: "earned",
          args: [MAMO_STRATEGY, MAMO_TOKEN],
        }),
        client.readContract({
          address: MAMO_STAKING,
          abi: ABI,
          functionName: "earned",
          args: [MAMO_STRATEGY, CBBTC_TOKEN],
        }),
      ]);

    const rawPrincipal =
      principalResult.status === "fulfilled" ? principalResult.value : 0n;
    const rawMamoRewards =
      mamoRewardResult.status === "fulfilled" ? mamoRewardResult.value : 0n;
    const rawCbBtcRewards =
      cbBtcRewardResult.status === "fulfilled" ? cbBtcRewardResult.value : 0n;

    const principalAmount = formatUnits(rawPrincipal, MAMO_DECIMALS);
    const mamoRewardAmount = formatUnits(rawMamoRewards, MAMO_DECIMALS);
    const cbBtcRewardAmount = formatUnits(rawCbBtcRewards, CBBTC_DECIMALS);

    const principalPriceUsd = safeNumber(prices.MAMO);
    const mamoRewardPriceUsd = safeNumber(prices.MAMO);
    const cbBtcRewardPriceUsd = safeNumber(prices.CBBTC);

    const principalValueUsd = principalAmount * principalPriceUsd;
    const mamoRewardValueUsd = mamoRewardAmount * mamoRewardPriceUsd;
    const cbBtcRewardValueUsd = cbBtcRewardAmount * cbBtcRewardPriceUsd;

    const rows = [];

    if (principalAmount > 0) {
      rows.push({
        token_symbol: "MAMO",
        token_name: "MAMO",
        network: "base",
        amount: principalAmount,
        value_usd: principalValueUsd,
        price_per_unit_usd: principalPriceUsd,
        category: "protocol",
        protocol: "Mamo",
        is_yield_position: true,
        snapshot_time: snapshotTime,
      });
    }

    if (mamoRewardAmount > 0) {
      rows.push({
        token_symbol: "MAMO",
        token_name: "MAMO Reward",
        network: "base",
        amount: mamoRewardAmount,
        value_usd: mamoRewardValueUsd,
        price_per_unit_usd: mamoRewardPriceUsd,
        category: "reward",
        protocol: "Mamo",
        is_yield_position: true,
        snapshot_time: snapshotTime,
      });
    }

    if (cbBtcRewardAmount > 0) {
      rows.push({
        token_symbol: "cbBTC",
        token_name: "Coinbase Wrapped BTC Reward",
        network: "base",
        amount: cbBtcRewardAmount,
        value_usd: cbBtcRewardValueUsd,
        price_per_unit_usd: cbBtcRewardPriceUsd,
        category: "reward",
        protocol: "Mamo",
        is_yield_position: true,
        snapshot_time: snapshotTime,
      });
    }

    console.log("[mamo] contract-derived data", {
      walletAddress,
      ownerWallet: MAMO_OWNER_WALLET,
      strategy: MAMO_STRATEGY,
      principalAmount,
      mamoRewardAmount,
      cbBtcRewardAmount,
      principalPriceUsd,
      mamoRewardPriceUsd,
      cbBtcRewardPriceUsd,
      principalValueUsd,
      mamoRewardValueUsd,
      cbBtcRewardValueUsd,
      prices,
    });

    return rows;
  } catch (error) {
    console.error("[mamo] failed to read contract data", error);
    return [];
  }
}