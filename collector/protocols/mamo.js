import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(),
});

const MAMO_STAKING = "0x7855B0821401Ab078f6Cf457dEAFae775fF6c7A3";
const MAMO_STRATEGY = "0x51c5290167e933fdDB5B27A1690377dB05813FBa";

const MAMO_TOKEN = "0x7300B37DfdAb110d83290A29DfB31B1740219fE";
const CBBTC_TOKEN = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";

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

function formatUnits(value, decimals) {
  return Number(value) / 10 ** decimals;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getPriceMapFromDebank(context = {}) {
  const debankData = context.debankData || {};
  const allTokens = Array.isArray(debankData.allTokens) ? debankData.allTokens : [];

  const map = new Map();

  for (const token of allTokens) {
    const symbol = String(token?.optimized_symbol || token?.symbol || "").toUpperCase();
    const price = safeNumber(token?.price || 0);

    if (symbol && price > 0) {
      map.set(symbol, price);
    }
  }

  return {
    MAMO: map.get("MAMO") || 0,
    CBBTC: map.get("CBBTC") || map.get("CBBTC") || map.get("BTC") || 0,
  };
}

export async function collectMamoProtocol(wallet, context = {}) {
  const snapshotTime = context.snapshotTime || new Date().toISOString();
  const prices = getPriceMapFromDebank(context);

  try {
    const [rawPrincipal, rawMamoRewards, rawCbBtcRewards] = await Promise.all([
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
      strategy: MAMO_STRATEGY,
      principalAmount,
      mamoRewardAmount,
      cbBtcRewardAmount,
      principalValueUsd,
      mamoRewardValueUsd,
      cbBtcRewardValueUsd,
    });

    return rows;
  } catch (error) {
    console.error("[mamo] failed to read contract data", error);
    return [];
  }
}