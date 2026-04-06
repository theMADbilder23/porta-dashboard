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
    time: Math.floor(c.openTime / 1000), // seconds for chart libs
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume),
  }))
}

export async function fetchQubicCandles(): Promise<ChartCandle[]> {
  const res = await fetch(
    "https://api.qubicswap.com/candles?interval=1d&days=180"
  )

  if (!res.ok) {
    throw new Error("Failed to fetch Qubic candles")
  }

  const data: QubicCandle[] = await res.json()

  return transformQubicCandles(data)
}