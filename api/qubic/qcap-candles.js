const QCAP_CANDLES_URL =
  "https://qubicswap.com/api/v1/markets/QCAP/candles?interval=1d&days=180&limit=200"

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeCandle(candle) {
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

function extractCandles(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  return []
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const response = await fetch(QCAP_CANDLES_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch QCAP candles from upstream source",
      })
    }

    const text = await response.text()

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      return res.status(502).json({
        error: "Invalid JSON received from upstream source",
      })
    }

    const rawCandles = extractCandles(parsed)
    const candles = rawCandles.map(normalizeCandle).filter(Boolean)

    return res.status(200).json(candles)
  } catch {
    return res.status(500).json({
      error: "Unexpected error while fetching QCAP candles",
    })
  }
}