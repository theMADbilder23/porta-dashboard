export type PortaTimeframe = "1h" | "4h" | "1d" | "3d" | "1w" | "1m"

export type ChartCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type AssetSourceKind = "gecko_pool" | "qubicswap" | "gate_spot"

export type AssetRegistryEntry = {
  assetKey: string
  symbol: string
  network: string
  source: AssetSourceKind

  /**
   * Optional token contract address.
   * Useful for metadata or future discovery fallbacks,
   * but tracked EVM assets should prefer locked poolAddress.
   */
  tokenAddress?: string

  /**
   * Exact liquidity pool address used for chart / OHLCV fetching.
   * This is the critical field for matching Dexscreener as closely as possible.
   */
  poolAddress?: string

  /**
   * Optional preferred dex label for metadata/debugging.
   */
  preferredDex?: string

  /**
   * Optional chart metadata for clarity/debugging.
   */
  quoteSymbol?: string
  pairLabel?: string

  /**
   * Optional centralized exchange pair metadata.
   * Used for exchange-specific candle sourcing such as Gate spot.
   */
  gateCurrencyPair?: string
  gateBaseSymbol?: string
  gateQuoteSymbol?: string
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

export type GateSpotCandlestickRow = Array<string | number>

export type GateSpotCandlesticksResponse = GateSpotCandlestickRow[]