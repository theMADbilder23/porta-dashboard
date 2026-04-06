export type QubicCandle = {
  open: string
  high: string
  low: string
  close: string
  volume: string
  openTime: number
}

export type ChartCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function transformQubicCandles(data: QubicCandle[]): ChartCandle[] {
  return data.map((c) => ({
    time: Math.floor(c.openTime / 1000),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume),
  }))
}

export async function fetchQubicCandles(): Promise<ChartCandle[]> {
  const res = await fetch(
    "https://qubicswap.com/api/v1/markets/QCAP/candles?interval=1d&days=180&limit=200"
  )

  console.log("QCAP candles status:", res.status)

  const raw = await res.text()
  console.log("QCAP candles raw response:", raw.slice(0, 1000))

  const parsed = JSON.parse(raw)

  if (Array.isArray(parsed)) {
    return transformQubicCandles(parsed)
  }

  if (Array.isArray(parsed?.data)) {
    return transformQubicCandles(parsed.data)
  }

  return []
}