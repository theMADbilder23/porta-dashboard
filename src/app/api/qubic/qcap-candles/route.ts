const QCAP_CANDLES_URL =
  "https://qubicswap.com/api/v1/markets/QCAP/candles?interval=1d&days=180&limit=200"

function toNumber(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeCandle(candle: any) {
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

function extractCandles(payload: any) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export async function GET() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(QCAP_CANDLES_URL, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 PortaDashboard/1.0",
        Referer: "https://qubicswap.com/",
        Origin: "https://qubicswap.com",
      },
      cache: "no-store",
      signal: controller.signal,
    })

    const contentType = response.headers.get("content-type") || ""
    const rawText = await response.text()

    if (!response.ok) {
      return Response.json(
        {
          error: "Upstream fetch failed",
          status: response.status,
          contentType,
          preview: rawText.slice(0, 500),
        },
        { status: 502 }
      )
    }

    let parsed: any
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return Response.json(
        {
          error: "Upstream returned non-JSON response",
          contentType,
          preview: rawText.slice(0, 500),
        },
        { status: 502 }
      )
    }

    const rawCandles = extractCandles(parsed)
    const candles = rawCandles.map(normalizeCandle).filter(Boolean)

    if (!candles.length) {
      return Response.json(
        {
          error: "No valid candles returned after normalization",
          rawCount: Array.isArray(rawCandles) ? rawCandles.length : 0,
          sample: Array.isArray(rawCandles) ? rawCandles.slice(0, 3) : [],
        },
        { status: 502 }
      )
    }

    return Response.json(candles)
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