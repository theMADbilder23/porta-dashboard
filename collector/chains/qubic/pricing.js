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

  if (!candidates.length) return 0;

  const preferred =
    candidates.find((row) => normalizeSymbol(row.symbol) === "QCAP") ||
    candidates[0];

  const derived = safeNumber(preferred.price_usd) / safeNumber(preferred.price_qu);

  console.log("[qubic/pricing] deriveQubicUsdFromMap", {
    candidate_count: candidates.length,
    preferred_symbol: preferred?.symbol || null,
    preferred_price_usd: preferred?.price_usd || 0,
    preferred_price_qu: preferred?.price_qu || 0,
    derived_qubic_usd: derived,
  });

  return derived;
}

export async function getQubicPriceMap({ forceRefresh = false } = {}) {
  const now = Date.now();

  if (!forceRefresh && cachedPriceMap && now - cachedAtMs < PRICE_CACHE_TTL_MS) {
    return cachedPriceMap;
  }

  try {
    const liveMap = await fetchQubicswapPriceMap();

    console.log("[qubic/pricing] fetched live map", {
      key_count: Object.keys(liveMap || {}).length,
      sample_keys: Object.keys(liveMap || {}).slice(0, 20),
      has_qcap: Boolean(liveMap?.QCAP),
      has_qubic: Boolean(liveMap?.QUBIC),
      qcap_row: liveMap?.QCAP || null,
      qubic_row: liveMap?.QUBIC || null,
    });

    const merged = {
      ...getFallbackPriceMap(),
      ...liveMap,
    };

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

    console.log("[qubic/pricing] final merged map", {
      qcap_price_usd: merged?.QCAP?.price_usd || 0,
      qubic_price_usd: merged?.QUBIC?.price_usd || 0,
      qcap_source: merged?.QCAP?.source || null,
      qubic_source: merged?.QUBIC?.source || null,
    });

    cachedPriceMap = merged;
    cachedAtMs = now;
    return cachedPriceMap;
  } catch (err) {
    console.error("[qubic/pricing] failed to fetch Qubicswap prices:", err);

    if (cachedPriceMap) return cachedPriceMap;

    cachedPriceMap = getFallbackPriceMap();
    cachedAtMs = now;
    return cachedPriceMap;
  }
}

export function getPriceForSymbol(priceMap, symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return 0;

  const row = priceMap?.[normalized];
  const price = safeNumber(row?.price_usd);

  console.log("[qubic/pricing] getPriceForSymbol", {
    requested_symbol: normalized,
    found: Boolean(row),
    row: row || null,
    resolved_price_usd: price,
  });

  return price;
}