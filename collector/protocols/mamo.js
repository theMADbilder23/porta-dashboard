import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(),
});

// Mamo staking contract
const MAMO_STAKING = "0x362A80d4c5Cf2A1c4C134cdE21836f6FC2ae81CE";

// Tokens
const MAMO_TOKEN = "0x7300B37DfdAb110d83290A29DfB31B1740219fE";
const CBBTC_TOKEN = "0xcbb7c0000ab88b473b1f5afd9e808440eed33bf";

// Minimal ABI
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

// helper
function formatUnits(value, decimals) {
  return Number(value) / 10 ** decimals;
}

export async function getMamoPosition(userAddress, prices = {}) {
  try {
    // 1. PRINCIPAL (MAMO deposited)
    const rawBalance = await client.readContract({
      address: MAMO_STAKING,
      abi: ABI,
      functionName: "balanceOf",
      args: [userAddress],
    });

    const mamoDeposited = formatUnits(rawBalance, 18);

    // 2. REWARDS
    const [rawMamoRewards, rawBtcRewards] = await Promise.all([
      client.readContract({
        address: MAMO_STAKING,
        abi: ABI,
        functionName: "earned",
        args: [userAddress, MAMO_TOKEN],
      }),
      client.readContract({
        address: MAMO_STAKING,
        abi: ABI,
        functionName: "earned",
        args: [userAddress, CBBTC_TOKEN],
      }),
    ]);

    const mamoRewards = formatUnits(rawMamoRewards, 18);
    const btcRewards = formatUnits(rawBtcRewards, 8);

    // 3. PRICING (fallback safe)
    const mamoPrice = prices.MAMO || 0;
    const btcPrice = prices.cbbtc || prices.BTC || 0;

    const depositedUsd = mamoDeposited * mamoPrice;
    const rewardsUsd =
      mamoRewards * mamoPrice +
      btcRewards * btcPrice;

    return {
      protocol: "Mamo",
      type: "staking",

      tokens: [
        {
          symbol: "MAMO",
          amount: mamoDeposited,
          value_usd: depositedUsd,
          category: "protocol",
        },
      ],

      rewards: [
        {
          symbol: "MAMO",
          amount: mamoRewards,
          value_usd: mamoRewards * mamoPrice,
        },
        {
          symbol: "cbBTC",
          amount: btcRewards,
          value_usd: btcRewards * btcPrice,
        },
      ],

      total_value_usd: depositedUsd,
      total_rewards_usd: rewardsUsd,
    };
  } catch (err) {
    console.error("Mamo fetch error:", err);
    return null;
  }
}