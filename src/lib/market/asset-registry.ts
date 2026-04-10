import type { AssetRegistryEntry } from "@/lib/market/types"

export const ASSET_REGISTRY: Record<string, AssetRegistryEntry> = {
  "base:WELL": {
    assetKey: "base:WELL",
    symbol: "WELL",
    network: "base",
    source: "gecko_pool",
    tokenAddress: "0xA88594D404727625A9437C3f886C7643872296AE",
    preferredDex: "aerodrome",
  },

  "base:MAMO": {
    assetKey: "base:MAMO",
    symbol: "MAMO",
    network: "base",
    source: "gecko_pool",
    tokenAddress: "0x7300B37DfdfAb110d83290A29DfB31B1740219fE",
    preferredDex: "aerodrome",
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