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

type ChartRegistryEntry = {
  preferredSource: Exclude<ChartSource, "none">;
  tradingviewSymbol?: string | null;
  dexscreenerUrl?: string | null;
  proxyAssetKey?: string | null;
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

function buildAssetKey(network?: string | null, tokenSymbol?: string | null) {
  const chain = normalizeLower(network);
  const symbol = normalizeUpper(tokenSymbol);

  if (!chain || !symbol) return "";
  return `${chain}:${symbol}`;
}

const CHART_REGISTRY: Record<string, ChartRegistryEntry> = {
  "base:WELL": {
    preferredSource: "tradingview",
    tradingviewSymbol: "GATEIO:WELLUSDT",
    dexscreenerUrl: "https://dexscreener.com/base/0xa88594d404727625a9437c3f886c7643872296ae?embed=1&theme=dark",
  },

  "base:STKWELL": {
    preferredSource: "tradingview",
    proxyAssetKey: "base:WELL",
  },

  "eth:ETH": {
    preferredSource: "tradingview",
    tradingviewSymbol: "BITSTAMP:ETHUSD",
  },

  "ethereum:ETH": {
    preferredSource: "tradingview",
    tradingviewSymbol: "BITSTAMP:ETHUSD",
  },

  "base:ETH": {
    preferredSource: "tradingview",
    tradingviewSymbol: "BITSTAMP:ETHUSD",
  },

  "base:WETH": {
    preferredSource: "tradingview",
    tradingviewSymbol: "BITSTAMP:ETHUSD",
  },

  "base:USDC": {
    preferredSource: "tradingview",
    tradingviewSymbol: "CRYPTOCAP:USDC",
  },

  "base:MAMO": {
    preferredSource: "dexscreener",
    dexscreenerUrl: "https://dexscreener.com/base/0xe2b3aa806e56603a244bfc111c9474f7dedd03db?embed=1&theme=dark",
  },

  "qubic:QUBIC": {
    preferredSource: "tradingview",
    tradingviewSymbol: "GATEIO:QUBICUSDT",
  },

  "qubic:QCAP": {
    preferredSource: "tradingview",
    tradingviewSymbol: "GATEIO:QUBICUSDT",
  },
};

function resolveRegistryEntry(assetKey: string, visited = new Set<string>()): ChartRegistryEntry | null {
  if (!assetKey) return null;
  if (visited.has(assetKey)) return null;

  visited.add(assetKey);

  const entry = CHART_REGISTRY[assetKey];
  if (!entry) return null;

  if (entry.proxyAssetKey) {
    const proxied = resolveRegistryEntry(entry.proxyAssetKey, visited);
    if (!proxied) return null;

    return {
      preferredSource: entry.preferredSource || proxied.preferredSource,
      tradingviewSymbol: proxied.tradingviewSymbol ?? null,
      dexscreenerUrl: proxied.dexscreenerUrl ?? null,
    };
  }

  return entry;
}

export function resolveChartConfig({
  network,
  tokenSymbol,
}: ResolveChartConfigInput): ResolvedChartConfig {
  const assetKey = buildAssetKey(network, tokenSymbol);
  const entry = resolveRegistryEntry(assetKey);

  if (!entry) {
    return {
      preferredSource: "none",
      availableSources: ["none"],
      dexscreenerUrl: null,
      tradingviewSymbol: null,
    };
  }

  const availableSources: ChartSource[] = [];

  if (entry.tradingviewSymbol) {
    availableSources.push("tradingview");
  }

  if (entry.dexscreenerUrl) {
    availableSources.push("dexscreener");
  }

  if (!availableSources.length) {
    return {
      preferredSource: "none",
      availableSources: ["none"],
      dexscreenerUrl: null,
      tradingviewSymbol: null,
    };
  }

  const preferredSource = availableSources.includes(entry.preferredSource)
    ? entry.preferredSource
    : availableSources[0];

  return {
    preferredSource,
    availableSources,
    dexscreenerUrl: entry.dexscreenerUrl ?? null,
    tradingviewSymbol: entry.tradingviewSymbol ?? null,
  };
}