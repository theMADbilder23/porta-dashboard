export type PortaTimeframe = "1h" | "4h" | "1d" | "1w"

export type ChartCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type AssetSourceKind = "gecko_pool" | "qubicswap"

export type AssetRegistryEntry = {
  assetKey: string
  symbol: string
  network: string
  source: AssetSourceKind
  tokenAddress?: string
  preferredDex?: string
}

export type ResolvedPool = {
  network: string
  tokenAddress: string
  poolAddress: string
  dexName: string | null
  baseSymbol: string | null
  quoteSymbol: string | null
}

export type GeckoOhlcvResponse = {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]>
    }
  }
  meta?: {
    base?: {
      address?: string
      symbol?: string
      name?: string
    }
    quote?: {
      address?: string
      symbol?: string
      name?: string
    }
  }
}