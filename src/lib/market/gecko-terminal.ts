import type {
  AssetRegistryEntry,
  ChartCandle,
  GateSpotCandlesticksResponse,
  GeckoOhlcvResponse,
  PortaTimeframe,
  ResolvedPool,
} from "@/lib/market/types"

const GECKO_BASE_URL = "https://api.coingecko.com/api/v3"
const GATE_BASE_URL = "https://api.gateio.ws/api/v4"

type GeckoTopPoolsResponse = {
  data?: Array<{
    type?: string
    id?: string
    attributes?: {
      address?: string
      name?: string
      reserve_in_usd?: string
      volume_usd?: {
        h24?: string
      }
    }
    relationships?: {
      dex?: {
        data?: {
          id?: string
        }
      }
    }
  }>
  included?: Array<{
    id?: string
    type?: string
    attributes?: {
      name?: string
    }
  }>
}

function getDemoHeaders(): HeadersInit {
  const apiKey = process.env.COINGECKO_DEMO_API_KEY

  if (!apiKey) {
    return {
      accept: "application/json",
    }
  }

  return {
    accept: "application/json",
    "x-cg-demo-api-key": apiKey,
  }
}

function getGateHeaders(): HeadersInit {
  return {
    accept: "application/json",
  }
}

function safeNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim()
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

function uniqueCandlesByTime(candles: ChartCandle[]): ChartCandle[] {
  const byTime = new Map<number, ChartCandle>()

  for (const candle of candles) {
    if (!Number.isFinite(candle.time) || candle.time <= 0) continue
    byTime.set(candle.time, candle)
  }

  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

function startOfUtcDay(timestampSeconds: number): number {
  const date = new Date(timestampSeconds * 1000)
  return (
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    ) / 1000
  )
}

function startOfUtcWeek(timestampSeconds: number): number {
  const date = new Date(timestampSeconds * 1000)
  const day = date.getUTCDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - diffToMonday,
      0,
      0,
      0,
      0
    )
  )
  return Math.floor(monday.getTime() / 1000)
}

function startOfUtcMonth(timestampSeconds: number): number {
  const date = new Date(timestampSeconds * 1000)
  return (
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0) / 1000
  )
}

function aggregateGroupedCandles(
  candles: ChartCandle[],
  bucketFn: (timestampSeconds: number) => number
): ChartCandle[] {
  if (!candles.length) return []

  const groups = new Map<number, ChartCandle[]>()

  for (const candle of candles) {
    const bucketStart = bucketFn(candle.time)

    if (!groups.has(bucketStart)) {
      groups.set(bucketStart, [])
    }

    groups.get(bucketStart)!.push(candle)
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, group]) => {
      const sorted = [...group].sort((a, b) => a.time - b.time)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]

      return {
        time: bucketStart,
        open: first.open,
        high: Math.max(...sorted.map((c) => c.high)),
        low: Math.min(...sorted.map((c) => c.low)),
        close: last.close,
        volume: sorted.reduce((sum, candle) => sum + candle.volume, 0),
      }
    })
}

function aggregateCandlesBySeconds(
  candles: ChartCandle[],
  bucketSizeSeconds: number
): ChartCandle[] {
  return aggregateGroupedCandles(candles, (timestampSeconds) => {
    return Math.floor(timestampSeconds / bucketSizeSeconds) * bucketSizeSeconds
  })
}

function aggregateCandlesForPortaTimeframe(
  candles: ChartCandle[],
  timeframe: PortaTimeframe
): ChartCandle[] {
  const normalized = uniqueCandlesByTime(candles)

  switch (timeframe) {
    case "1h":
    case "1d":
      return normalized

    case "4h":
      return aggregateCandlesBySeconds(normalized, 4 * 60 * 60)

    case "3d":
      return aggregateGroupedCandles(normalized, (timestampSeconds) => {
        const dayStart = startOfUtcDay(timestampSeconds)
        const dayIndex = Math.floor(dayStart / 86400)
        return Math.floor(dayIndex / 3) * 3 * 86400
      })

    case "1w":
      return aggregateGroupedCandles(normalized, startOfUtcWeek)

    case "1m":
      return aggregateGroupedCandles(normalized, startOfUtcMonth)

    default:
      return normalized
  }
}

function mapGeckoPortaTimeframe(timeframe: PortaTimeframe): {
  geckoTimeframe: "minute" | "hour" | "day"
  aggregate: string
  limit: number
  needsPostAggregation: boolean
} {
  switch (timeframe) {
    case "1h":
      return {
        geckoTimeframe: "hour",
        aggregate: "1",
        limit: 1000,
        needsPostAggregation: false,
      }

    case "4h":
      return {
        geckoTimeframe: "hour",
        aggregate: "1",
        limit: 1000,
        needsPostAggregation: true,
      }

    case "1d":
      return {
        geckoTimeframe: "day",
        aggregate: "1",
        limit: 1000,
        needsPostAggregation: false,
      }

    case "3d":
    case "1w":
    case "1m":
      return {
        geckoTimeframe: "day",
        aggregate: "1",
        limit: 1000,
        needsPostAggregation: true,
      }

    default:
      return {
        geckoTimeframe: "hour",
        aggregate: "1",
        limit: 1000,
        needsPostAggregation: true,
      }
  }
}

function mapGatePortaTimeframe(timeframe: PortaTimeframe): {
  gateInterval: "1h" | "1d"
  limit: number
  needsPostAggregation: boolean
} {
  switch (timeframe) {
    case "1h":
      return {
        gateInterval: "1h",
        limit: 1000,
        needsPostAggregation: false,
      }

    case "4h":
      return {
        gateInterval: "1h",
        limit: 1000,
        needsPostAggregation: true,
      }

    case "1d":
      return {
        gateInterval: "1h",
        limit: 1000,
        needsPostAggregation: true,
      }

    case "3d":
    case "1w":
    case "1m":
      return {
        gateInterval: "1d",
        limit: 1000,
        needsPostAggregation: true,
      }

    default:
      return {
        gateInterval: "1h",
        limit: 1000,
        needsPostAggregation: true,
      }
  }
}

function buildDexNameLookup(
  included: GeckoTopPoolsResponse["included"]
): Map<string, string> {
  const map = new Map<string, string>()

  for (const item of included ?? []) {
    if (item?.type !== "dex") continue

    const id = normalizeText(item.id)
    const name = normalizeText(item.attributes?.name)

    if (id && name) {
      map.set(id, name)
    }
  }

  return map
}

function pickPreferredPool(
  response: GeckoTopPoolsResponse,
  preferredDex?: string
): ResolvedPool | null {
  const pools = Array.isArray(response?.data) ? response.data : []
  const dexNameLookup = buildDexNameLookup(response?.included)

  if (!pools.length) return null

  const normalizedPools = pools.map((pool) => {
    const dexId = normalizeText(pool.relationships?.dex?.data?.id)
    const dexName = dexNameLookup.get(dexId) ?? null

    return {
      poolAddress: normalizeText(pool.attributes?.address),
      dexName,
      reserveUsd: safeNumber(pool.attributes?.reserve_in_usd),
      volume24hUsd: safeNumber(pool.attributes?.volume_usd?.h24),
    }
  })

  const preferred = normalizeLower(preferredDex)

  const filtered = preferred
    ? normalizedPools.filter((pool) =>
        normalizeLower(pool.dexName).includes(preferred)
      )
    : normalizedPools

  const ranked = (filtered.length ? filtered : normalizedPools)
    .filter((pool) => pool.poolAddress)
    .sort((a, b) => {
      const liquidityDiff = b.reserveUsd - a.reserveUsd
      if (liquidityDiff !== 0) return liquidityDiff
      return b.volume24hUsd - a.volume24hUsd
    })

  const best = ranked[0]
  if (!best) return null

  return {
    network: "base",
    tokenAddress: "",
    poolAddress: best.poolAddress,
    dexName: best.dexName,
    baseSymbol: null,
    quoteSymbol: null,
  }
}

/**
 * Fallback discovery only.
 * Known tracked assets should use exact locked poolAddress from asset-registry.
 */
export async function resolveBasePoolFromTokenAddress(params: {
  tokenAddress: string
  preferredDex?: string
}): Promise<ResolvedPool> {
  const tokenAddress = normalizeText(params.tokenAddress)
  if (!tokenAddress) {
    throw new Error("Missing token address for Gecko pool resolution")
  }

  const url = new URL(
    `${GECKO_BASE_URL}/onchain/networks/base/tokens/${tokenAddress}/pools`
  )
  url.searchParams.set("include", "base_token,quote_token,dex")
  url.searchParams.set("sort", "h24_volume_usd_liquidity_desc")
  url.searchParams.set("page", "1")

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getDemoHeaders(),
    next: { revalidate: 30 },
  })

  if (!response.ok) {
    throw new Error(
      `[gecko] top pools request failed: ${response.status} ${response.statusText}`
    )
  }

  const json = (await response.json()) as GeckoTopPoolsResponse
  const resolved = pickPreferredPool(json, params.preferredDex)

  if (!resolved) {
    throw new Error("[gecko] no matching pool found for token")
  }

  return {
    ...resolved,
    tokenAddress,
  }
}

export function getLockedPoolAddress(entry: AssetRegistryEntry): string | null {
  const poolAddress = normalizeText(entry.poolAddress)
  return poolAddress || null
}

function getGateCurrencyPair(entry: AssetRegistryEntry): string | null {
  const pair = normalizeText(entry.gateCurrencyPair)
  return pair || null
}

export async function fetchGeckoPoolCandles(params: {
  poolAddress: string
  timeframe: PortaTimeframe
  currency?: "usd" | "token"
  tokenSide?: "base" | "quote"
}): Promise<ChartCandle[]> {
  const poolAddress = normalizeText(params.poolAddress)
  if (!poolAddress) {
    throw new Error("Missing pool address for Gecko OHLCV request")
  }

  const mapped = mapGeckoPortaTimeframe(params.timeframe)

  const url = new URL(
    `${GECKO_BASE_URL}/onchain/networks/base/pools/${poolAddress}/ohlcv/${mapped.geckoTimeframe}`
  )
  url.searchParams.set("aggregate", mapped.aggregate)
  url.searchParams.set("limit", String(mapped.limit))
  url.searchParams.set("currency", params.currency ?? "usd")
  url.searchParams.set("token", params.tokenSide ?? "base")

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getDemoHeaders(),
    next: { revalidate: 30 },
  })

  if (!response.ok) {
    throw new Error(
      `[gecko] OHLCV request failed: ${response.status} ${response.statusText}`
    )
  }

  const json = (await response.json()) as GeckoOhlcvResponse
  const rows = json?.data?.attributes?.ohlcv_list ?? []

  const candles = rows
    .map((row) => {
      const [timestamp, open, high, low, close, volume] = row

      return {
        time: safeNumber(timestamp),
        open: safeNumber(open),
        high: safeNumber(high),
        low: safeNumber(low),
        close: safeNumber(close),
        volume: safeNumber(volume),
      }
    })
    .filter(
      (candle) =>
        candle.time > 0 &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.volume)
    )

  const normalized = uniqueCandlesByTime(candles)

  if (mapped.needsPostAggregation) {
    return aggregateCandlesForPortaTimeframe(normalized, params.timeframe)
  }

  return normalized
}

function parseGateSpotCandleRow(row: Array<string | number>): ChartCandle | null {
  if (!Array.isArray(row) || row.length < 6) {
    return null
  }

  const timestamp = safeNumber(row[0])
  const volume = safeNumber(row[1])
  const close = safeNumber(row[2])
  const high = safeNumber(row[3])
  const low = safeNumber(row[4])
  const open = safeNumber(row[5])

  if (
    timestamp <= 0 ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(volume)
  ) {
    return null
  }

  return {
    time: timestamp,
    open,
    high,
    low,
    close,
    volume,
  }
}

export async function fetchGateSpotCandles(params: {
  currencyPair: string
  timeframe: PortaTimeframe
}): Promise<ChartCandle[]> {
  const currencyPair = normalizeText(params.currencyPair)
  if (!currencyPair) {
    throw new Error("Missing Gate currency pair for spot candlestick request")
  }

  const mapped = mapGatePortaTimeframe(params.timeframe)

  const url = new URL(`${GATE_BASE_URL}/spot/candlesticks`)
  url.searchParams.set("currency_pair", currencyPair)
  url.searchParams.set("interval", mapped.gateInterval)
  url.searchParams.set("limit", String(mapped.limit))

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getGateHeaders(),
    next: { revalidate: 30 },
  })

  if (!response.ok) {
    throw new Error(
      `[gate] candlesticks request failed: ${response.status} ${response.statusText}`
    )
  }

  const json = (await response.json()) as GateSpotCandlesticksResponse

  const candles = (Array.isArray(json) ? json : [])
    .map((row) => parseGateSpotCandleRow(row))
    .filter((candle): candle is ChartCandle => Boolean(candle))

  const normalized = uniqueCandlesByTime(candles)

  if (mapped.needsPostAggregation) {
    return aggregateCandlesForPortaTimeframe(normalized, params.timeframe)
  }

  return normalized
}

export async function fetchLockedAssetCandles(params: {
  entry: AssetRegistryEntry
  timeframe: PortaTimeframe
  currency?: "usd" | "token"
  tokenSide?: "base" | "quote"
}): Promise<ChartCandle[]> {
  const { entry, timeframe } = params

  if (entry.source === "gecko_pool") {
    const lockedPoolAddress = getLockedPoolAddress(entry)

    if (lockedPoolAddress) {
      return fetchGeckoPoolCandles({
        poolAddress: lockedPoolAddress,
        timeframe,
        currency: params.currency ?? "usd",
        tokenSide: params.tokenSide ?? "base",
      })
    }

    if (entry.tokenAddress && entry.network === "base") {
      const resolved = await resolveBasePoolFromTokenAddress({
        tokenAddress: entry.tokenAddress,
        preferredDex: entry.preferredDex,
      })

      return fetchGeckoPoolCandles({
        poolAddress: resolved.poolAddress,
        timeframe,
        currency: params.currency ?? "usd",
        tokenSide: params.tokenSide ?? "base",
      })
    }

    throw new Error(
      `[market] no locked pool or fallback token address for ${entry.assetKey}`
    )
  }

  if (entry.source === "gate_spot") {
    const gateCurrencyPair = getGateCurrencyPair(entry)

    if (!gateCurrencyPair) {
      throw new Error(`[market] missing Gate currency pair for ${entry.assetKey}`)
    }

    return fetchGateSpotCandles({
      currencyPair: gateCurrencyPair,
      timeframe,
    })
  }

  throw new Error(`[market] unsupported locked candle source: ${entry.source}`)
}