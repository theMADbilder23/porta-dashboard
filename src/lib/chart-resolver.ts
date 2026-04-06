export type ChartSource = "tradingview" | "dexscreener" | "none";

export type ChartTimeframe = "1H" | "4H" | "1D" | "1W";

export type ResolvedChartConfig = {
  preferredSource: ChartSource;
  availableSources: ChartSource[];
  dexscreenerUrl?: string | null;
  tradingviewSymbol?: string | null;
};

type ResolveChartConfigInput = {
  network?: string | null;
  tokenSymbol?: string | null;
  assetId?: string | null;
};

function normalize(value?: string | null) {
  return String(value || "").trim();
}

function normalizeLower(value?: string | null) {
  return normalize(value).toLowerCase();
}

function normalizeUpper(value?: string | null) {
  return normalize(value).toUpperCase();
}

function buildDexscreenerUrl(network: string, tokenSymbol: string) {
  const chain = normalizeLower(network);
  const symbol = encodeURIComponent(normalize(tokenSymbol));

  if (!chain || !symbol) return null;

  return `https://dexscreener.com/${chain}/${symbol}?embed=1&theme=dark`;
}

function resolveTradingViewSymbol(network: string, tokenSymbol: string) {
  const chain = normalizeLower(network);
  const symbol = normalizeUpper(tokenSymbol);

  if (!symbol) return null;

  if (chain === "qubic") {
    if (symbol === "QUBIC") return "QUBIC:QUBICUSD";
    if (symbol === "QCAP") return "QUBIC:QCAPUSD";
    return `QUBIC:${symbol}USD`;
  }

  if (symbol === "BTC" || symbol === "WBTC" || symbol === "CBBTC") {
    return "BINANCE:BTCUSDT";
  }

  if (symbol === "ETH" || symbol === "WETH") {
    return "BINANCE:ETHUSDT";
  }

  return null;
}

export function resolveChartConfig({
  network,
  tokenSymbol,
  assetId,
}: ResolveChartConfigInput): ResolvedChartConfig {
  const chain = normalizeLower(network);
  const symbol = normalizeUpper(tokenSymbol);
  const normalizedAssetId = normalize(assetId);

  const evmOrDexChains = new Set([
    "base",
    "eth",
    "ethereum",
    "arbitrum",
    "optimism",
    "polygon",
    "bsc",
    "binance-smart-chain",
    "solana",
    "avax",
  ]);

  const dexscreenerUrl =
    evmOrDexChains.has(chain) && symbol
      ? buildDexscreenerUrl(chain, normalizedAssetId || symbol)
      : null;

  const tradingviewSymbol = resolveTradingViewSymbol(chain, symbol);

  if (dexscreenerUrl && tradingviewSymbol) {
    return {
      preferredSource: chain === "qubic" ? "tradingview" : "dexscreener",
      availableSources: ["dexscreener", "tradingview"],
      dexscreenerUrl,
      tradingviewSymbol,
    };
  }

  if (dexscreenerUrl) {
    return {
      preferredSource: "dexscreener",
      availableSources: ["dexscreener"],
      dexscreenerUrl,
      tradingviewSymbol: null,
    };
  }

  if (tradingviewSymbol) {
    return {
      preferredSource: "tradingview",
      availableSources: ["tradingview"],
      dexscreenerUrl: null,
      tradingviewSymbol,
    };
  }

  return {
    preferredSource: "none",
    availableSources: ["none"],
    dexscreenerUrl: null,
    tradingviewSymbol: null,
  };
}