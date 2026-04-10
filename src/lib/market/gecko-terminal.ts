import type {
  ChartCandle,
  GeckoOhlcvResponse,
  PortaTimeframe,
  ResolvedPool,
} from "@/lib/market/types"

const GECKO_BASE_URL = "https://api.coingecko.com/api/v3"

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

function mapPortaTimeframe(timeframe: PortaTimeframe): {
  geckoTimeframe: "hour" | "day"
  aggregate: string
  limit: number
} {
  switch (timeframe) {
    case "1h":
      return {
        geckoTimeframe: "hour",
        aggregate: "1",
        limit: 240,
      }

    case "4h":
      return {
        geckoTimeframe: "hour",
        aggregate: "4",
        limit: 240,
      }

    case "1d":
      return {
        geckoTimeframe: "day",
        aggregate: "1",
        limit: 240,
      }

    case "1w":
      return {
        geckoTimeframe: "day",
        aggregate: "1",
        limit: 240,
      }

    default:
      return {
        geckoTimeframe: "hour",
        aggregate: "4",
        limit: 240,
      }
  }
}

function buildDexNameLookup(included: GeckoTopPoolsResponse["included"]): Map<string, string> {
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
      raw: pool,
    }
  })

  const preferred = normalizeLower(preferredDex)

  const filtered = preferred
    ? normalizedPools.filter((pool) => normalizeLower(pool.dexName).includes(preferred))
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

  const mapped = mapPortaTimeframe(params.timeframe)

  const url = new URL(
    `${GECKO_BASE_URL}/onchain/networks/base/pools/${poolAddress}/ohlcv/${mapped.geckoTimeframe}`
  )
  url.searchParams.set("aggregate", mapped.aggregate)
  url.searchParams.set("limit", String(mapped.limit))
  url.searchParams.set("currency", params.currency ?? "usd")
  url.searchParams.set("token", params.tokenSide ?? "base")
  url.searchParams.set("include_empty_intervals", "true")

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
    .filter((candle) => candle.time > 0)
    .sort((a, b) => a.time - b.time)

  if (params.timeframe === "1w") {
    return collapseDailyCandlesToWeekly(candles)
  }

  return candles
}

function collapseDailyCandlesToWeekly(candles: ChartCandle[]): ChartCandle[] {
  if (!candles.length) return []

  const weeks = new Map<number, ChartCandle[]>()

  for (const candle of candles) {
    const date = new Date(candle.time * 1000)
    const utcMidnight = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
    const weekBucket = Math.floor(utcMidnight / (7 * 24 * 60 * 60 * 1000))

    if (!weeks.has(weekBucket)) {
      weeks.set(weekBucket, [])
    }

    weeks.get(weekBucket)!.push(candle)
  }

  return Array.from(weeks.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => {
      const sorted = [...group].sort((a, b) => a.time - b.time)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]

      return {
        time: first.time,
        open: first.open,
        high: Math.max(...sorted.map((c) => c.high)),
        low: Math.min(...sorted.map((c) => c.low)),
        close: last.close,
        volume: sorted.reduce((sum, candle) => sum + candle.volume, 0),
      }
    })
}