import { getQubicBalance } from "./balances.js";
import { getQubicOwnedAssets, findOwnedAssetByName } from "./assets.js";
import {
  normalizeQubicUnits,
  buildQubicHoldingRow,
  buildQubicAssetHoldingRow,
  buildQubicRewardHoldingRow,
} from "./parser.js";
import { getQubicPriceMap, getPriceForSymbol } from "./pricing.js";
import { getLatestHoldingForWalletSymbol } from "../../db.js";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isWednesdayUtc(snapshotTime) {
  return new Date(snapshotTime).getUTCDay() === 3;
}

function detectQcapRewardDelta({
  snapshotTime,
  currentQubicAmount,
  previousQubicAmount,
}) {
  const currentAmount = safeNumber(currentQubicAmount);
  const previousAmount = safeNumber(previousQubicAmount);
  const delta = currentAmount - previousAmount;

  const MIN_REWARD_QUBIC = 200000;
  const MAX_REWARD_QUBIC = 10000000;

  const isCandidate =
    isWednesdayUtc(snapshotTime) &&
    delta >= MIN_REWARD_QUBIC &&
    delta <= MAX_REWARD_QUBIC;

  return {
    delta_qubic: delta,
    is_detected_reward: isCandidate,
    detected_reward_qubic: isCandidate ? delta : 0,
  };
}

export async function collectQubicHoldings({
  wallet,
  snapshotId,
  snapshotTime,
}) {
  const identity = String(wallet?.wallet_address || "").trim();

  if (!identity) {
    console.warn("[qubic] missing wallet identity");
    return {
      holdings: [],
      snapshotMetrics: {
        total_value_usd: 0,
        total_rewards_usd: 0,
        total_claimed_usd: 0,
        total_pending_usd: 0,
        total_claimable_usd: 0,
        total_claimable_token: 0,
        rewards_token_symbol: null,
      },
    };
  }

  const [balanceResult, ownedAssets, priceMap, previousQubicHolding] =
    await Promise.all([
      getQubicBalance(identity),
      getQubicOwnedAssets(identity),
      getQubicPriceMap(),
      getLatestHoldingForWalletSymbol(wallet.id, "QUBIC"),
    ]);

  const holdings = [];

  const qubicAmount = safeNumber(balanceResult?.raw_balance || 0);
  const qubicPrice = getPriceForSymbol(priceMap, "QUBIC");
  const qubicValueUsd = qubicAmount * qubicPrice;

  if (qubicAmount > 0) {
    holdings.push(
      buildQubicHoldingRow({
        walletId: wallet.id,
        snapshotId,
        snapshotTime,
        identity,
        amount: qubicAmount,
        valueUsd: qubicValueUsd,
      })
    );
  }

  const qcapAsset = findOwnedAssetByName(ownedAssets, "QCAP");

  if (qcapAsset) {
    const qcapAmount = normalizeQubicUnits(
      qcapAsset.raw_units,
      qcapAsset.decimal_places
    );
    const qcapPrice = getPriceForSymbol(priceMap, "QCAP");
    const qcapValueUsd = qcapAmount * qcapPrice;

    if (qcapAmount > 0) {
      holdings.push(
        buildQubicAssetHoldingRow({
          walletId: wallet.id,
          snapshotId,
          snapshotTime,
          identity,
          assetName: "QCAP",
          amount: qcapAmount,
          valueUsd: qcapValueUsd,
        })
      );
    }
  }

  const previousQubicAmount = safeNumber(previousQubicHolding?.amount || 0);

  const rewardDetection = detectQcapRewardDelta({
    snapshotTime,
    currentQubicAmount: qubicAmount,
    previousQubicAmount,
  });

  const detectedRewardQubic = safeNumber(rewardDetection.detected_reward_qubic);
  const detectedRewardUsd = detectedRewardQubic * qubicPrice;

  if (detectedRewardQubic > 0) {
    holdings.push(
      buildQubicRewardHoldingRow({
        walletId: wallet.id,
        snapshotId,
        snapshotTime,
        identity,
        amount: detectedRewardQubic,
        valueUsd: detectedRewardUsd,
      })
    );
  }

  const totalValueUsd = holdings
    .filter((holding) => holding?.category !== "reward")
    .reduce((sum, holding) => sum + safeNumber(holding?.value_usd || 0), 0);

  console.log("[qubic] collected holdings", {
    wallet_name: wallet?.name,
    identity,
    qubic_amount: qubicAmount,
    previous_qubic_amount: previousQubicAmount,
    qubic_delta: rewardDetection.delta_qubic,
    qcap_reward_detected: rewardDetection.is_detected_reward,
    detected_reward_qubic: detectedRewardQubic,
    detected_reward_usd: detectedRewardUsd,
    qubic_price_usd: qubicPrice,
    qcap_amount: qcapAsset
      ? normalizeQubicUnits(qcapAsset.raw_units, qcapAsset.decimal_places)
      : 0,
    qcap_price_usd: getPriceForSymbol(priceMap, "QCAP"),
    holdings_count: holdings.length,
    total_value_usd: totalValueUsd,
  });

  return {
    holdings,
    snapshotMetrics: {
      total_value_usd: totalValueUsd,
      total_rewards_usd: 0,
      total_claimed_usd: 0,
      total_pending_usd: 0,
      total_claimable_usd: 0,
      total_claimable_token: 0,
      rewards_token_symbol: null,
    },
  };
}