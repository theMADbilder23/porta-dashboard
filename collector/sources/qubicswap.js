const QUBICSWAP_SUMMARY_URL =
  "https://qubicswap.com/api/v1/tokens/summary?category=token&page=1&per=200&sortBy=volume_7d_usd&order=desc&dividends=false&assetCategory=All&q=";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function extractRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.tokens)) return json.tokens;
  if (Array.isArray(json?.data?.items)) return json.data.items;
  if (Array.isArray(json?.data?.tokens)) return json.data.tokens;
  return [];
}

function normalizeTokenRow(row) {
  const symbol = normalizeSymbol(row?.symbol || row?.id || row?.name);
  if (!symbol) return null;

  const priceUsd = safeNumber(row?.priceUSD ?? row?.priceUsd ?? row?.price_usd);
  const priceQu = safeNumber(row?.priceQU ?? row?.priceQu ?? row?.price_qu);

  return {
    id: String(row?.id || symbol).trim(),
    symbol,
    name: String(row?.name || symbol).trim(),
    price_usd: priceUsd,
    price_qu: priceQu,
    market_cap_usd: safeNumber(
      row?.marketCapUSD ?? row?.marketCapUsd ?? row?.market_cap_usd
    ),
    market_cap_qu: safeNumber(
      row?.marketCapQU ?? row?.marketCapQu ?? row?.market_cap_qu
    ),
    volume_24h_usd: safeNumber(
      row?.volume24hUSD ?? row?.volume24hUsd ?? row?.volume_24h_usd
    ),
    volume_24h_qu: safeNumber(
      row?.volume24hQU ?? row?.volume24hQu ?? row?.volume_24h_qu
    ),
    volume_7d_usd: safeNumber(
      row?.volume7dUSD ?? row?.volume7dUsd ?? row?.volume_7d_usd
    ),
    volume_7d_qu: safeNumber(
      row?.volume7dQU ?? row?.volume7dQu ?? row?.volume_7d_qu
    ),
    change_24h_percent: safeNumber(
      row?.change24hPercent ?? row?.change24h ?? row?.change_24h_percent
    ),
    change_7d_percent: safeNumber(
      row?.change7dPercent ?? row?.change7d ?? row?.change_7d_percent
    ),
    generates_dividends: Boolean(row?.generatesDividends),
    issuer: row?.issuer || null,
    icon_url: row?.iconUrl || row?.icon_url || null,
    source: "qubicswap",
    raw: row,
  };
}

export async function fetchQubicswapTokenSummary() {
  const response = await fetch(QUBICSWAP_SUMMARY_URL, {
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent": "porta-collector/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`[qubicswap] request failed: ${response.status}`);
  }

  const json = await response.json();
  const rows = extractRows(json);

  console.log("[qubicswap] response shape", {
    is_array: Array.isArray(json),
    top_level_keys: json && typeof json === "object" ? Object.keys(json).slice(0, 20) : [],
    extracted_row_count: rows.length,
    first_row_keys:
      rows.length && rows[0] && typeof rows[0] === "object"
        ? Object.keys(rows[0]).slice(0, 20)
        : [],
    first_row_preview: rows[0] || null,
  });

  const normalized = rows
    .map(normalizeTokenRow)
    .filter((row) => row && row.symbol);

  console.log("[qubicswap] normalized rows", {
    normalized_count: normalized.length,
    sample_symbols: normalized.slice(0, 15).map((row) => row.symbol),
    qcap_row: normalized.find((row) => row.symbol === "QCAP") || null,
  });

  return normalized;
}

export async function fetchQubicswapPriceMap() {
  const rows = await fetchQubicswapTokenSummary();
  const map = {};

  for (const row of rows) {
    map[row.symbol] = row;
  }

  console.log("[qubicswap] built price map", {
    key_count: Object.keys(map).length,
    sample_keys: Object.keys(map).slice(0, 20),
    qcap_row: map.QCAP || null,
  });

  return map;
}