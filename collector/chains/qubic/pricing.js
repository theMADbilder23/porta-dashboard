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

    cachedPriceMap = {
      ...getFallbackPriceMap(),
      ...liveMap,
    };
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