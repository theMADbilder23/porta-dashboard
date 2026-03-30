import { MERKL_BASE, BASE_CHAIN_ID } from "../config.js";
import { safeNumber } from "../utils.js";

export async function getMerklWellRewards(walletAddress) {
  try {
    const url = new URL(`${MERKL_BASE}/users/${walletAddress}/rewards`);
    url.searchParams.set("chainId", String(BASE_CHAIN_ID));
    url.searchParams.set("reloadChainId", String(BASE_CHAIN_ID));
    url.searchParams.set("claimableOnly", "false");
    url.searchParams.set("type", "TOKEN");
    url.searchParams.set("breakdownPage", "0");

    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
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
    const claimable = Math.max(0, earned - claimed);
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

export function buildSnapshotMetrics(merklRewards) {
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