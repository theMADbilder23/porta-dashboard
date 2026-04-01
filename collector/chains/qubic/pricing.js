import { fetchQubicswapPriceMap } from "../../sources/qubicswap.js";

const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPriceMap = null;
let cachedAtMs = 0;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function getFallbackPriceMap() {
  return {
    QUBIC: {
      symbol: "QUBIC",
      name: "QUBIC",
      price_usd: 0,
      source: "fallback",
    },
    QCAP: {
      symbol: "QCAP",
      name: "QCAP",
      price_usd: 0,
      source: "fallback",
    },
  };
}

function deriveQubicUsdFromMap(priceMap) {
  const candidates = Object.values(priceMap || {}).filter((row) => {
    const priceUsd = safeNumber(row?.price_usd);
    const priceQu = safeNumber(row?.price_qu);
    return priceUsd > 0 && priceQu > 0;
  });

  if (candidates.length === 0) return 0;

  // Prefer QCAP first since we verified it manually from Qubicswap
  const preferred =
    candidates.find((row) => normalizeSymbol(row.symbol) === "QCAP") ||
    candidates[0];

  return safeNumber(preferred.price_usd) / safeNumber(preferred.price_qu);
}

export async function getQubicPriceMap({ forceRefresh = false } = {}) {
  const now = Date.now();

  if (
    !forceRefresh &&
    cachedPriceMap &&
    now - cachedAtMs < PRICE_CACHE_TTL_MS
  ) {
    return cachedPriceMap;
  }

  try {
    const liveMap = await fetchQubicswapPriceMap();

    const merged = {
      ...getFallbackPriceMap(),
      ...liveMap,
    };

    // If QUBIC is not returned directly by Qubicswap, derive it from priceUSD / priceQU
    if (!safeNumber(merged.QUBIC?.price_usd)) {
      const derivedQubicUsd = deriveQubicUsdFromMap(merged);

      if (derivedQubicUsd > 0) {
        merged.QUBIC = {
          symbol: "QUBIC",
          name: "QUBIC",
          price_usd: derivedQubicUsd,
          source: "qubicswap_derived",
        };
      }
    }

    cachedPriceMap = merged;
    cachedAtMs = now;

    return cachedPriceMap;
  } catch (err) {
    console.error("[qubic/pricing] failed to fetch Qubicswap prices:", err);

    if (cachedPriceMap) {
      return cachedPriceMap;
    }

    cachedPriceMap = getFallbackPriceMap();
    cachedAtMs = now;

    return cachedPriceMap;
  }
}

export function getPriceForSymbol(priceMap, symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return 0;

  const row = priceMap?.[normalized];
  return safeNumber(row?.price_usd);
}