import type { AssetRegistryEntry } from "@/lib/market/types"

export const ASSET_REGISTRY: Record<string, AssetRegistryEntry> = {
  "base:WELL": {
    assetKey: "base:WELL",
    symbol: "WELL",
    network: "base",
    source: "gecko_pool",
    tokenAddress: "0xa88594D404727625A9437C3f886C7643872296Ae",
    poolAddress: "0x89D0F320ac73dd7d9513FFC5bc58D1161452a657",
    preferredDex: "aerodrome",
    quoteSymbol: "WETH",
    pairLabel: "WELL / WETH",
  },

  "base:MAMO": {
    assetKey: "base:MAMO",
    symbol: "MAMO",
    network: "base",
    source: "gecko_pool",
    tokenAddress: "0x7300B37DfdFAb110d83290A29DfB31B1740219fE",
    poolAddress: "0xE2B3aA806e56603a244bfC111c9474F7DeDD03db",
    preferredDex: "aerodrome",
    quoteSymbol: "cbBTC",
    pairLabel: "MAMO / cbBTC",
  },

  "qubic:QCAP": {
    assetKey: "qubic:QCAP",
    symbol: "QCAP",
    network: "qubic",
    source: "qubicswap",
  },

  "qubic:QUBIC": {
    assetKey: "qubic:QUBIC",
    symbol: "QUBIC",
    network: "qubic",
    source: "qubicswap",
  },
}

const ASSET_ALIASES: Record<string, string> = {
  "STKWELL": "base:WELL",
  "base:STKWELL": "base:WELL",
  "BASE:STKWELL": "base:WELL",

  "WELL": "base:WELL",
  "BASE:WELL": "base:WELL",

  "MAMO": "base:MAMO",
  "BASE:MAMO": "base:MAMO",

  "QCAP": "qubic:QCAP",
  "QUBIC:QCAP": "qubic:QCAP",

  "QUBIC": "qubic:QUBIC",
  "QUBIC:QUBIC": "qubic:QUBIC",
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim()
}

function normalizeUpper(value: unknown): string {
  return normalizeText(value).toUpperCase()
}

function normalizeNetwork(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

export function normalizeAssetRegistryKey(assetKey: string | null | undefined): string {
  const raw = normalizeText(assetKey)
  if (!raw) return ""

  if (ASSET_ALIASES[raw]) {
    return ASSET_ALIASES[raw]
  }

  const upperRaw = normalizeUpper(raw)
  if (ASSET_ALIASES[upperRaw]) {
    return ASSET_ALIASES[upperRaw]
  }

  if (!raw.includes(":")) {
    return ASSET_ALIASES[upperRaw] ?? upperRaw
  }

  const [network = "", symbol = ""] = raw.split(":")
  const normalized = `${normalizeNetwork(network)}:${normalizeUpper(symbol)}`

  if (ASSET_ALIASES[normalized]) {
    return ASSET_ALIASES[normalized]
  }

  const upperNormalized = normalizeUpper(normalized)
  if (ASSET_ALIASES[upperNormalized]) {
    return ASSET_ALIASES[upperNormalized]
  }

  return normalized
}

export function getAssetRegistryEntry(
  assetKey: string
): AssetRegistryEntry | null {
  const normalizedKey = normalizeAssetRegistryKey(assetKey)
  return ASSET_REGISTRY[normalizedKey] ?? null
}