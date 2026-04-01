const QUBICSWAP_SUMMARY_URL =
  "https://qubicswap.com/api/v1/tokens/summary?category=token&page=1&per=200&sortBy=volume_7d_usd&order=desc&dividends=false&assetCategory=All&q=";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeTokenRow(row) {
  const symbol = normalizeSymbol(row?.symbol || row?.id);
  if (!symbol) return null;

  const priceUsd = safeNumber(row?.priceUSD);
  const priceQu = safeNumber(row?.priceQU);

  return {
    id: String(row?.id || symbol).trim(),
    symbol,
    name: String(row?.name || symbol).trim(),
    price_usd: priceUsd,
    price_qu: priceQu,
    market_cap_usd: safeNumber(row?.marketCapUSD),
    market_cap_qu: safeNumber(row?.marketCapQU),
    volume_24h_usd: safeNumber(row?.volume24hUSD),
    volume_24h_qu: safeNumber(row?.volume24hQU),
    volume_7d_usd: safeNumber(row?.volume7dUSD),
    volume_7d_qu: safeNumber(row?.volume7dQU),
    change_24h_percent: safeNumber(row?.change24hPercent),
    change_7d_percent: safeNumber(row?.change7dPercent),
    generates_dividends: Boolean(row?.generatesDividends),
    issuer: row?.issuer || null,
    icon_url: row?.iconUrl || null,
    source: "qubicswap",
    raw: row,
  };
}

export async function fetchQubicswapTokenSummary() {
  const response = await fetch(QUBICSWAP_SUMMARY_URL, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[qubicswap] request failed: ${response.status}`);
  }

  const json = await response.json();

  const rows = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
      ? json
      : [];

  return rows
    .map(normalizeTokenRow)
    .filter((row) => row && row.symbol && row.price_usd > 0);
}

export async function fetchQubicswapPriceMap() {
  const rows = await fetchQubicswapTokenSummary();
  const map = {};

  for (const row of rows) {
    map[row.symbol] = row;
  }

  return map;
}