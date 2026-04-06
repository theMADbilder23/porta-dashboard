const QCAP_CANDLES_URL =
  "https://qubicswap.com/api/v1/markets/QCAP/candles?interval=1d&days=180&limit=200"

function toNumber(value: any): number | null {
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
  try {
    const response = await fetch(QCAP_CANDLES_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (!response.ok) {
      return Response.json(
        { error: "Upstream fetch failed" },
        { status: response.status }
      )
    }

    const text = await response.text()

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      return Response.json(
        { error: "Invalid JSON from upstream" },
        { status: 502 }
      )
    }

    const raw = extractCandles(parsed)
    const candles = raw.map(normalizeCandle).filter(Boolean)

    return Response.json(candles)
  } catch {
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}