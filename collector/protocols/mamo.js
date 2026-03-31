import { createPublicClient, http, getAddress } from "viem";
import { base } from "viem/chains";

const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

const MAMO_STAKING = getAddress("0x7855B0821401Ab078f6Cf457dEAFae775Ff6c7A3");
const MAMO_STRATEGY = getAddress("0x51c5290167e933fdDB5B27A1690377dB05813FBa");

const MAMO_TOKEN = getAddress("0x7300b37dfdfab110d83290a29dfb31b1740219fe");
const CBBTC_TOKEN = getAddress("0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf");

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

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatUnits(value, decimals) {
  return Number(value) / 10 ** decimals;
}

function normalizeAddress(value) {
  try {
    return value ? getAddress(value) : null;
  } catch {
    return null;
  }
}

function getPriceMapFromDebank(context = {}) {
  const debankData = context.debankData || {};
  const allTokens = Array.isArray(debankData.allTokens) ? debankData.allTokens : [];

  const bySymbol = new Map();
  const byAddress = new Map();

  for (const token of allTokens) {
    const symbol = String(token?.optimized_symbol || token?.symbol || "")
      .trim()
      .toUpperCase();

    const price = safeNumber(token?.price);
    const id = normalizeAddress(token?.id);
    const address =
      normalizeAddress(token?.address) ||
      normalizeAddress(token?.token_address);

    if (symbol && price > 0 && !bySymbol.has(symbol)) {
      bySymbol.set(symbol, price);
    }

    if (id && price > 0 && !byAddress.has(id)) {
      byAddress.set(id, price);
    }

    if (address && price > 0 && !byAddress.has(address)) {
      byAddress.set(address, price);
    }
  }

  return {
    MAMO:
      byAddress.get(MAMO_TOKEN) ||
      bySymbol.get("MAMO") ||
      0,
    CBBTC:
      byAddress.get(CBBTC_TOKEN) ||
      bySymbol.get("CBBTC") ||
      bySymbol.get("CBBTC ") ||
      bySymbol.get("BTC") ||
      0,
  };
}

export async function collectMamoProtocol(wallet, context = {}) {
  const snapshotTime = context.snapshotTime || new Date().toISOString();
  const prices = getPriceMapFromDebank(context);

  try {
    const walletAddress =
      typeof wallet === "string"
        ? wallet
        : wallet?.wallet_address || wallet?.address || null;

    if (!walletAddress) {
      console.warn("[mamo] missing wallet address", { wallet });
      return [];
    }

    const normalizedWallet = getAddress(walletAddress);

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

    const principalAmount = formatUnits(rawPrincipal, 18);
    const mamoRewardAmount = formatUnits(rawMamoRewards, 18);
    const cbBtcRewardAmount = formatUnits(rawCbBtcRewards, 8);

    const principalValueUsd = principalAmount * prices.MAMO;
    const mamoRewardValueUsd = mamoRewardAmount * prices.MAMO;
    const cbBtcRewardValueUsd = cbBtcRewardAmount * prices.CBBTC;

    const rows = [];

    if (principalAmount > 0) {
      rows.push({
        token_symbol: "MAMO",
        token_name: "MAMO",
        network: "base",
        amount: principalAmount,
        value_usd: principalValueUsd,
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
        category: "reward",
        protocol: "Mamo",
        is_yield_position: true,
        snapshot_time: snapshotTime,
      });
    }

    console.log("[mamo] contract-derived data", {
      wallet: normalizedWallet,
      principalAmount,
      mamoRewardAmount,
      cbBtcRewardAmount,
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