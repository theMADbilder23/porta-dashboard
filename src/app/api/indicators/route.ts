import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  getAssetRegistryEntry,
  normalizeAssetRegistryKey,
} from "@/lib/market/asset-registry"
import {
  fetchLockedAssetCandles,
  getLockedPoolAddress,
} from "@/lib/market/gecko-terminal"
import { computeIndicators } from "@/lib/indicator-engine"
import type { ChartCandle, PortaTimeframe } from "@/lib/market/types"

const ALLOWED_TIMEFRAMES: PortaTimeframe[] = ["1h", "4h", "1d", "3d", "1w", "1m"]
const GECKO_BASE_URL = "https://api.coingecko.com/api/v3"

function normalizeAssetKey(value: string | null): string {
  return normalizeAssetRegistryKey(value)
}

function normalizeTimeframe(value: string | null): PortaTimeframe {
  const candidate = String(value ?? "4h").trim().toLowerCase() as PortaTimeframe
  return ALLOWED_TIMEFRAMES.includes(candidate) ? candidate : "4h"
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

  return (
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - diffToMonday,
      0,
      0,
      0,
      0
    ) / 1000
  )
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

function mapCoinGeckoDays(timeframe: PortaTimeframe): string {
  switch (timeframe) {
    case "1h":
      return "1"
    case "4h":
      return "7"
    case "1d":
      return "30"
    case "3d":
      return "90"
    case "1w":
      return "180"
    case "1m":
      return "365"
    default:
      return "7"
  }
}

async function fetchCoinGeckoOhlcCandles(params: {
  coinId: string
  timeframe: PortaTimeframe
}): Promise<ChartCandle[]> {
  const days = mapCoinGeckoDays(params.timeframe)

  const ohlcUrl = new URL(`${GECKO_BASE_URL}/coins/${params.coinId}/ohlc`)
  ohlcUrl.searchParams.set("vs_currency", "usd")
  ohlcUrl.searchParams.set("days", days)

  const volumeUrl = new URL(`${GECKO_BASE_URL}/coins/${params.coinId}/market_chart`)
  volumeUrl.searchParams.set("vs_currency", "usd")
  volumeUrl.searchParams.set("days", days)

  const [ohlcResponse, volumeResponse] = await Promise.all([
    fetch(ohlcUrl.toString(), {
      method: "GET",
      headers: getDemoHeaders(),
      next: { revalidate: 30 },
    }),
    fetch(volumeUrl.toString(), {
      method: "GET",
      headers: getDemoHeaders(),
      next: { revalidate: 30 },
    }),
  ])

  if (!ohlcResponse.ok) {
    throw new Error(
      `[indicators] ${params.coinId} OHLC fetch failed: ${ohlcResponse.status} ${ohlcResponse.statusText}`
    )
  }

  if (!volumeResponse.ok) {
    throw new Error(
      `[indicators] ${params.coinId} market_chart fetch failed: ${volumeResponse.status} ${volumeResponse.statusText}`
    )
  }

  const ohlcJson = await ohlcResponse.json()
  const volumeJson = await volumeResponse.json()

  const ohlcRows = Array.isArray(ohlcJson) ? ohlcJson : []
  const volumeRows = Array.isArray(volumeJson?.total_volumes)
    ? volumeJson.total_volumes
    : []

  const volumeByTime = new Map<number, number>()

  for (const row of volumeRows) {
    if (!Array.isArray(row) || row.length < 2) continue
    const timestampMs = safeNumber(row[0])
    const volume = safeNumber(row[1])
    const timestampSec = Math.floor(timestampMs / 1000)
    if (timestampSec > 0) {
      volumeByTime.set(timestampSec, volume)
    }
  }

  const candles = ohlcRows
    .map((row: unknown) => {
      if (!Array.isArray(row) || row.length < 5) return null

      const timestampMs = safeNumber(row[0])
      const time = Math.floor(timestampMs / 1000)
      const open = safeNumber(row[1])
      const high = safeNumber(row[2])
      const low = safeNumber(row[3])
      const close = safeNumber(row[4])

      let volume = 0

      if (volumeByTime.has(time)) {
        volume = volumeByTime.get(time) ?? 0
      } else {
        const candidates = Array.from(volumeByTime.keys()).sort(
          (a, b) => Math.abs(a - time) - Math.abs(b - time)
        )
        const nearest = candidates[0]
        if (nearest != null && Math.abs(nearest - time) <= 4 * 60 * 60) {
          volume = volumeByTime.get(nearest) ?? 0
        }
      }

      return {
        time,
        open,
        high,
        low,
        close,
        volume,
      }
    })
    .filter((candle): candle is ChartCandle => {
      return Boolean(
        candle &&
          candle.time > 0 &&
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close)
      )
    })

  return aggregateCandlesForPortaTimeframe(candles, params.timeframe)
}

function deriveSignalBias(params: {
  rsi: number | null
  stochK: number | null
  stochD: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
}): {
  label: "Bullish" | "Neutral" | "Bearish" | "Unavailable"
  summary: string
} {
  const { rsi, stochK, stochD, macd, macdSignal, macdHistogram } = params

  if (
    rsi == null ||
    stochK == null ||
    stochD == null ||
    macd == null ||
    macdSignal == null ||
    macdHistogram == null
  ) {
    return {
      label: "Unavailable",
      summary: "Not enough history to derive a signal bias yet.",
    }
  }

  let score = 0

  if (rsi >= 55) score += 1
  if (rsi <= 45) score -= 1

  if (stochK > stochD) score += 1
  if (stochK < stochD) score -= 1

  if (macd > macdSignal) score += 1
  if (macd < macdSignal) score -= 1

  if (macdHistogram > 0) score += 1
  if (macdHistogram < 0) score -= 1

  if (score >= 2) {
    return {
      label: "Bullish",
      summary: "Momentum and trend signals are leaning bullish.",
    }
  }

  if (score <= -2) {
    return {
      label: "Bearish",
      summary: "Momentum and trend signals are leaning bearish.",
    }
  }

  return {
    label: "Neutral",
    summary: "Signals are mixed and do not show a strong directional edge.",
  }
}

export async function GET(request: NextRequest) {
  try {
    const requestedAsset = String(
      request.nextUrl.searchParams.get("asset") ?? ""
    ).trim()

    const asset = normalizeAssetKey(requestedAsset)
    const timeframe = normalizeTimeframe(
      request.nextUrl.searchParams.get("timeframe")
    )

    if (!asset) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing asset query param",
        },
        { status: 400 }
      )
    }

    const entry = getAssetRegistryEntry(asset)

    if (!entry) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported asset: ${requestedAsset}`,
          requestedAsset,
          canonicalAsset: asset,
        },
        { status: 404 }
      )
    }

    let candles: ChartCandle[] = []
    let resolvedSource = entry.source

    if (entry.source === "qubicswap") {
      if (asset !== "qubic:QUBIC" && asset !== "qubic:qubic") {
        return NextResponse.json(
          {
            ok: false,
            error: `Indicator source not wired yet for ${requestedAsset}`,
            requestedAsset,
            canonicalAsset: asset,
            source: entry.source,
          },
          { status: 501 }
        )
      }

      candles = await fetchCoinGeckoOhlcCandles({
        coinId: "qubic-network",
        timeframe,
      })
      
      resolvedSource = entry.source
    } else {
      if (entry.source !== "gecko_pool") {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid asset source for ${requestedAsset}`,
            requestedAsset,
            canonicalAsset: asset,
            source: entry.source,
          },
          { status: 500 }
        )
      }

      candles = await fetchLockedAssetCandles({
        entry,
        timeframe,
        currency: "usd",
        tokenSide: "base",
      })
    }

    if (!candles.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `No candles returned for ${requestedAsset} on ${timeframe}`,
          requestedAsset,
          canonicalAsset: asset,
          source: resolvedSource,
        },
        { status: 424 }
      )
    }

    const indicators = computeIndicators(candles)

    const signalBias = deriveSignalBias({
      rsi: indicators.rsi,
      stochK: indicators.stoch_k,
      stochD: indicators.stoch_d,
      macd: indicators.macd,
      macdSignal: indicators.macd_signal,
      macdHistogram: indicators.macd_histogram,
    })

    return NextResponse.json({
      ok: true,
      asset: requestedAsset,
      canonicalAsset: asset,
      timeframe,
      source: resolvedSource,
      resolvedPool: {
        network: entry.network,
        tokenAddress: entry.tokenAddress ?? "",
        poolAddress: getLockedPoolAddress(entry) ?? "",
        dexName: entry.preferredDex ?? null,
        baseSymbol: entry.symbol ?? null,
        quoteSymbol: entry.quoteSymbol ?? null,
      },
      candleCount: candles.length,
      lastCandle: candles[candles.length - 1] ?? null,
      indicators,
      signalBias,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}