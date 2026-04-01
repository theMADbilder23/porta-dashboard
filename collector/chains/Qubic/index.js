import { getQubicBalance } from "./balances.js";
import { getQubicOwnedAssets, findOwnedAssetByName } from "./assets.js";
import {
  normalizeQubicUnits,
  buildQubicHoldingRow,
  buildQubicAssetHoldingRow,
} from "./parser.js";
import { getQubicPriceMap, getPriceForSymbol } from "./pricing.js";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

  const [balanceResult, ownedAssets, priceMap] = await Promise.all([
    getQubicBalance(identity),
    getQubicOwnedAssets(identity),
    getQubicPriceMap(),
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

  const totalValueUsd = holdings.reduce(
    (sum, holding) => sum + safeNumber(holding?.value_usd || 0),
    0
  );

  console.log("[qubic] collected holdings", {
    wallet_name: wallet?.name,
    identity,
    qubic_amount: qubicAmount,
    qcap_amount: qcapAsset
      ? normalizeQubicUnits(qcapAsset.raw_units, qcapAsset.decimal_places)
      : 0,
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