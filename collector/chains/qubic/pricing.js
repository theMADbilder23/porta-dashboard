function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Temporary Qubic pricing layer.
 *
 * For now this returns 0 until we wire the final live source.
 * This keeps the chain collector architecture clean and lets us
 * verify balances/assets routing first.
 */
export async function getQubicPriceMap() {
  return {
    QUBIC: 0,
    QCAP: 0,
  };
}

export function getPriceForSymbol(priceMap = {}, symbol = "") {
  const key = String(symbol || "").trim().toUpperCase();
  return safeNumber(priceMap?.[key] || 0);
}