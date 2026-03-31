import { createPublicClient, http, getAddress } from "viem";
import { base } from "viem/chains";

const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

// --- CONTRACTS (checksummed automatically) ---
const MAMO_STAKING = getAddress("0x7855B0821401Ab078f6Cf457dEAFae775Ff6c7A3");
const MAMO_STRATEGY = getAddress("0x51c5290167e933fdDB5B27A1690377dB05813FBa");

const MAMO_TOKEN = getAddress("0x7300b37dfdfab110d83290a29dfb31b1740219fe");
const CBBTC_TOKEN = getAddress("0xcbb7c0000aB88B473b1f5aFd9ef808440eed33Bf");

// --- ABI ---
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

// --- HELPERS ---
function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatUnits(value, decimals) {
  return Number(value) / 10 ** decimals;
}

// --- PRICE MAP ---
function getPriceMapFromDebank(context = {}) {
  const debankData = context.debankData || {};
  const allTokens = Array.isArray(debankData.allTokens)
    ? debankData.allTokens
    : [];

  const map = new Map();

  for (const token of allTokens) {
    const symbol = String(token.optimized_symbol || token.symbol || "")
      .toUpperCase()
      .trim();
    const price = safeNumber(token.price || 0);

    if (symbol && price > 0) {
      map.set(symbol, price);
    }
  }

  return {
    MAMO: map.get("MAMO") || 0,
    CBBTC: map.get("CBBTC") || map.get("CBBTC") || map.get("BTC") || 0,
  };
}

// --- MAIN FUNCTION ---
export async function collectMamoProtocol(wallet, context = {}) {
  const snapshotTime = context.snapshotTime || new Date().toISOString();
  const prices = getPriceMapFromDebank(context);

  try {
    const walletAddress = getAddress(wallet);

    // --- SAFE READS (no crash if one fails) ---
    const [rawPrincipal, rawMamoRewards, rawCbBtcRewards] =
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

    const principal = rawPrincipal.status === "fulfilled" ? rawPrincipal.value : 0;
    const mamoRewards =
      rawMamoRewards.status === "fulfilled" ? rawMamoRewards.value : 0;
    const cbBtcRewards =
      rawCbBtcRewards.status === "fulfilled" ? rawCbBtcRewards.value : 0;

    // --- FORMAT ---
    const principalAmount = formatUnits(principal, 18);
    const mamoRewardAmount = formatUnits(mamoRewards, 18);
    const cbBtcRewardAmount = formatUnits(cbBtcRewards, 8);

    // --- USD VALUES ---
    const principalValueUsd = principalAmount * prices.MAMO;
    const mamoRewardValueUsd = mamoRewardAmount * prices.MAMO;
    const cbBtcRewardValueUsd = cbBtcRewardAmount * prices.CBBTC;

    const rows = [];

    // --- PRINCIPAL ---
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

    // --- MAMO REWARDS ---
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

    // --- CBBTC REWARDS ---
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

    // --- DEBUG LOG ---
    console.log("[mamo] contract-derived data", {
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