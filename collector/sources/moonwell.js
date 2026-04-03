import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { STKWELL_CONTRACT } from "../config.js";
import { safeNumber } from "../utils.js";

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

export async function getStkWellBalance(walletAddress) {
  try {
    const raw = await baseClient.readContract({
      address: STKWELL_CONTRACT,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    return safeNumber(formatUnits(raw, 18));
  } catch (err) {
    console.error(
      `[collector] stkWELL balance lookup failed for ${walletAddress}`,
      err
    );
    return 0;
  }
}

export function buildStkWellHolding(stakedAmount, wellPrice, snapshotTime) {
  const safeAmount = safeNumber(stakedAmount);
  const safePrice = safeNumber(wellPrice);

  if (safeAmount <= 0) return null;

  return {
    token_symbol: "stkWELL",
    token_name: "stkWELL",
    network: "base",
    amount: safeAmount,
    value_usd: safeAmount * safePrice,
    category: "protocol",
    protocol: "Moonwell",
    is_yield_position: true,
    snapshot_time: snapshotTime,
  };
}

export function buildStkWellRewardHolding(merklRewards, snapshotTime) {
  const claimableAmount = safeNumber(merklRewards?.claimable || 0);
  const tokenPrice = safeNumber(merklRewards?.price || 0);
  const tokenSymbol =
    String(merklRewards?.token || "WELL").trim().toUpperCase() || "WELL";

  if (claimableAmount <= 0) return null;

  return {
    token_symbol: tokenSymbol,
    token_name: `${tokenSymbol} Reward`,
    network: "base",
    amount: claimableAmount,
    value_usd: claimableAmount * tokenPrice,
    category: "reward",
    protocol: "Moonwell",
    is_yield_position: true,
    snapshot_time: snapshotTime,
  };
}