import { normalizeAssetRegistryKey } from "@/lib/market/asset-registry"

export type ChartSource = "tradingview" | "dexscreener" | "none"

export type ChartTimeframe = "1H" | "4H" | "1D" | "1W"

export type ResolvedChartConfig = {
  preferredSource: ChartSource
  availableSources: ChartSource[]
  dexscreenerUrl?: string | null
  tradingviewSymbol?: string | null
}

type ResolveChartConfigInput = {
  network?: string | null
  tokenSymbol?: string | null
  assetId?: string | null
}

type ChartRegistryEntry = {
  preferredSource: Exclude<ChartSource, "none">
  tradingviewSymbol?: string | null
  dexscreenerUrl?: string | null
}

function normalize(value?: string | null): string {
  return String(value ?? "").trim()
}

function normalizeLower(value?: string | null): string {
  return normalize(value).toLowerCase()
}

function normalizeUpper(value?: string | null): string {
  return normalize(value).toUpperCase()
}

function buildAssetKey(network?: string | null, tokenSymbol?: string | null): string {
  const chain = normalizeLower(network)
  const symbol = normalizeUpper(tokenSymbol)

  if (!chain || !symbol) return ""
  return `${chain}:${symbol}`
}

const CHART_REGISTRY: Record<string, ChartRegistryEntry> = {
  "base:WELL": {
  preferredSource: "tradingview",
  tradingviewSymbol: "GATEIO:WELLUSDT",
  dexscreenerUrl:
    "https://dexscreener.com/base/0x89d0f320ac73dd7d9513ffc5bc58d1161452a657?embed=1&theme=dark",
},

  "ethereum:ETH": {
    preferredSource: "tradingview",
    tradingviewSymbol: "BITSTAMP:ETHUSD",
  },

  "eth:ETH": {
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
    dexscreenerUrl:
      "https://dexscreener.com/base/0xe2b3aa806e56603a244bfc111c9474f7dedd03db?embed=1&theme=dark",
  },

  "qubic:QUBIC": {
    preferredSource: "tradingview",
    tradingviewSymbol: "GATEIO:QUBICUSDT",
  },

  "qubic:QCAP": {
    preferredSource: "tradingview",
    tradingviewSymbol: "GATEIO:QUBICUSDT",
  },

  "base:CBBTC": {
    preferredSource: "tradingview",
    tradingviewSymbol: "BITSTAMP:BTCUSD",
  },

  "base:BTC": {
    preferredSource: "tradingview",
    tradingviewSymbol: "BITSTAMP:BTCUSD",
  },
}

function resolveRegistryEntry(assetKey: string): ChartRegistryEntry | null {
  if (!assetKey) return null

  const canonicalKey = normalizeAssetRegistryKey(assetKey)
  return CHART_REGISTRY[canonicalKey] ?? null
}

function resolveInputAssetKey({
  network,
  tokenSymbol,
  assetId,
}: ResolveChartConfigInput): string {
  const normalizedAssetId = normalize(assetId)
  if (normalizedAssetId) {
    return normalizeAssetRegistryKey(normalizedAssetId)
  }

  const derivedAssetKey = buildAssetKey(network, tokenSymbol)
  if (derivedAssetKey) {
    return normalizeAssetRegistryKey(derivedAssetKey)
  }

  return ""
}

export function resolveChartConfig({
  network,
  tokenSymbol,
  assetId,
}: ResolveChartConfigInput): ResolvedChartConfig {
  const assetKey = resolveInputAssetKey({
    network,
    tokenSymbol,
    assetId,
  })

  const entry = resolveRegistryEntry(assetKey)

  if (!entry) {
    return {
      preferredSource: "none",
      availableSources: ["none"],
      dexscreenerUrl: null,
      tradingviewSymbol: null,
    }
  }

  const availableSources: ChartSource[] = []

  if (entry.tradingviewSymbol) {
    availableSources.push("tradingview")
  }

  if (entry.dexscreenerUrl) {
    availableSources.push("dexscreener")
  }

  if (!availableSources.length) {
    return {
      preferredSource: "none",
      availableSources: ["none"],
      dexscreenerUrl: null,
      tradingviewSymbol: null,
    }
  }

  const preferredSource = availableSources.includes(entry.preferredSource)
    ? entry.preferredSource
    : availableSources[0]

  return {
    preferredSource,
    availableSources,
    dexscreenerUrl: entry.dexscreenerUrl ?? null,
    tradingviewSymbol: entry.tradingviewSymbol ?? null,
  }
}