const BASE_URLS = [
  "https://qubicswap.com/api/v1/markets/QCAP/candles",
  "https://qubicswap.com/api/v1/markets/qcap/candles",
]

type CandleRequestConfig = {
  interval: string
  limit: number
}

type RawCandle = {
  openTime?: number | string
  open?: number | string
  high?: number | string
  low?: number | string
  close?: number | string
  volume?: number | string
}

type JsonObject = Record<string, unknown>

type CandlePayload =
  | {
      page?: {
        oldestOpenTime?: number
        hasMoreOlder?: boolean
        newestOpenTime?: number
      }
      candles?: RawCandle[]
    }
  | RawCandle[]
  | {
      data?: RawCandle[]
      items?: RawCandle[]
      results?: RawCandle[]
      candles?: RawCandle[]
    }
  | JsonObject

const TIMEFRAME_MAP: Record<string, CandleRequestConfig> = {
  "30m": { interval: "30m", limit: 200 },
  "1h": { interval: "1h", limit: 200 },
  "2h": { interval: "2h", limit: 200 },
  "4h": { interval: "4h", limit: 200 },
  "8h": { interval: "8h", limit: 200 },
  "1d": { interval: "1d", limit: 200 },
  "7d": { interval: "7d", limit: 200 },
}

function toNumber(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeCandle(candle: RawCandle) {
  const openTime = Number(candle?.openTime)
  const open = toNumber(candle?.open)
  const high = toNumber(candle?.high)
  const low = toNumber(candle?.low)
  const close = toNumber(candle?.close)
  const volume = toNumber(candle?.volume)

  if (
    !Number.isFinite(openTime) ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null
  ) {
    return null
  }

  return {
    time: Math.floor(openTime / 1000),
    open,
    high,
    low,
    close,
    volume,
  }
}

function extractCandles(payload: CandlePayload): RawCandle[] {
  if (Array.isArray(payload)) return payload
  if ("candles" in payload && Array.isArray(payload.candles)) return payload.candles
  if ("data" in payload && Array.isArray(payload.data)) return payload.data
  if ("items" in payload && Array.isArray(payload.items)) return payload.items
  if ("results" in payload && Array.isArray(payload.results)) return payload.results
  return []
}

function buildUpstreamUrls(config: CandleRequestConfig): string[] {
  return BASE_URLS.map(
    (baseUrl) =>
      `${baseUrl}?interval=${encodeURIComponent(config.interval)}` +
      `&limit=${config.limit}`
  )
}

async function fetchFirstWorkingUpstream(args: {
  upstreamUrls: string[]
  signal: AbortSignal
}) {
  const attempts: Array<{
    upstreamUrl: string
    ok: boolean
    status: number | null
    contentType: string
    rawText: string
  }> = []

  for (const upstreamUrl of args.upstreamUrls) {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 PortaDashboard/1.0",
        Referer: "https://qubicswap.com/",
        Origin: "https://qubicswap.com",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      cache: "no-store",
      signal: args.signal,
    })

    const contentType = response.headers.get("content-type") || ""
    const rawText = await response.text()

    attempts.push({
      upstreamUrl,
      ok: response.ok,
      status: response.status,
      contentType,
      rawText,
    })

    if (response.ok) {
      return {
        success: true as const,
        upstreamUrl,
        contentType,
        rawText,
        attempts,
      }
    }
  }

  return {
    success: false as const,
    attempts,
  }
}

export async function GET(request: Request) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const { searchParams } = new URL(request.url)
    const timeframe = (searchParams.get("timeframe") || "1d").toLowerCase()
    const config = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP["8h"]
    const upstreamUrls = buildUpstreamUrls(config)

    const upstreamResult = await fetchFirstWorkingUpstream({
      upstreamUrls,
      signal: controller.signal,
    })

    if (!upstreamResult.success) {
      const lastAttempt = upstreamResult.attempts[upstreamResult.attempts.length - 1]

      return Response.json(
        {
          error: "Upstream fetch failed",
          timeframe,
          attemptedUrls: upstreamResult.attempts.map((attempt) => attempt.upstreamUrl),
          attempts: upstreamResult.attempts.map((attempt) => ({
            upstreamUrl: attempt.upstreamUrl,
            ok: attempt.ok,
            status: attempt.status,
            contentType: attempt.contentType,
            preview: attempt.rawText.slice(0, 500),
          })),
          status: lastAttempt?.status ?? 502,
          contentType: lastAttempt?.contentType ?? "",
          preview: lastAttempt?.rawText?.slice(0, 500) ?? "",
        },
        { status: 502 }
      )
    }

    let parsed: CandlePayload

    try {
      parsed = JSON.parse(upstreamResult.rawText) as CandlePayload
    } catch {
      return Response.json(
        {
          error: "Upstream returned non-JSON response",
          contentType: upstreamResult.contentType,
          preview: upstreamResult.rawText.slice(0, 500),
          timeframe,
          upstreamUrl: upstreamResult.upstreamUrl,
          attemptedUrls: upstreamResult.attempts.map((attempt) => attempt.upstreamUrl),
        },
        { status: 502 }
      )
    }

    const rawCandles = extractCandles(parsed)
    const candles = rawCandles
      .map(normalizeCandle)
      .filter(
        (
          candle
        ): candle is {
          time: number
          open: number
          high: number
          low: number
          close: number
          volume: number
        } => candle !== null
      )
      .sort((a, b) => a.time - b.time)

    if (!candles.length) {
      return Response.json(
        {
          error: "No valid candles returned after normalization",
          rawCount: Array.isArray(rawCandles) ? rawCandles.length : 0,
          sample: Array.isArray(rawCandles) ? rawCandles.slice(0, 3) : [],
          timeframe,
          upstreamUrl: upstreamResult.upstreamUrl,
          attemptedUrls: upstreamResult.attempts.map((attempt) => attempt.upstreamUrl),
        },
        { status: 502 }
      )
    }

    return Response.json({
      timeframe,
      interval: config.interval,
      candles,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error"

    return Response.json(
      {
        error: "Internal route failure",
        message,
      },
      { status: 500 }
    )
  } finally {
    clearTimeout(timeout)
  }
}