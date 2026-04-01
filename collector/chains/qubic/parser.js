function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeQubicUnits(rawUnits, decimalPlaces = 0) {
  const units = safeNumber(rawUnits);
  const decimals = safeNumber(decimalPlaces);

  if (decimals <= 0) return units;
  return units / 10 ** decimals;
}

export function buildQubicHoldingRow({
  walletId,
  snapshotId,
  snapshotTime,
  identity,
  amount,
  valueUsd = 0,
}) {
  return {
    wallet_id: walletId,
    snapshot_id: snapshotId,
    token_symbol: "QUBIC",
    token_name: "Qubic",
    network: "qubic",
    amount: safeNumber(amount),
    value_usd: safeNumber(valueUsd),
    category: "wallet",
    protocol: null,
    is_yield_position: false,
    snapshot_time: snapshotTime,
    source_address: identity,
  };
}

export function buildQubicAssetHoldingRow({
  walletId,
  snapshotId,
  snapshotTime,
  identity,
  assetName,
  amount,
  valueUsd = 0,
}) {
  return {
    wallet_id: walletId,
    snapshot_id: snapshotId,
    token_symbol: String(assetName || "").toUpperCase(),
    token_name: assetName,
    network: "qubic",
    amount: safeNumber(amount),
    value_usd: safeNumber(valueUsd),
    category: "wallet",
    protocol: null,
    is_yield_position: false,
    snapshot_time: snapshotTime,
    source_address: identity,
  };
}
export function buildQubicRewardHoldingRow({
  walletId,
  snapshotId,
  snapshotTime,
  identity,
  amount,
  valueUsd = 0,
}) {
  return {
    wallet_id: walletId,
    snapshot_id: snapshotId,
    token_symbol: "QUBIC",
    token_name: "Qubic Reward",
    network: "qubic",
    amount: safeNumber(amount),
    value_usd: safeNumber(valueUsd),
    category: "reward",
    protocol: "QCAP",
    is_yield_position: true,
    snapshot_time: snapshotTime,
    source_address: identity,
  };
}