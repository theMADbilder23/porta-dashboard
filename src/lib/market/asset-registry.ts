import type { AssetRegistryEntry } from "@/lib/market/types"

export const ASSET_REGISTRY: Record<string, AssetRegistryEntry> = {
  "base:WELL": {
    assetKey: "base:WELL",
    symbol: "WELL",
    network: "base",
    source: "gecko_pool",
    tokenAddress: "0xA88594D404727625A9437C3f886C7643872296AE",
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
    tokenAddress: "0x7300B37DfdfAb110d83290A29DfB31B1740219fE",
    poolAddress: "0xE2B3aA806e56603a244bFc111c9474F7DeDD03db",
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

export function getAssetRegistryEntry(assetKey: string): AssetRegistryEntry | null {
  return ASSET_REGISTRY[assetKey] ?? null
}