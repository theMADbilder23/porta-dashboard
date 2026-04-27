export type QubicCandle = {
  open: string | number
  high: string | number
  low: string | number
  close: string | number
  volume: string | number
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

type CandleRouteResponse = {
  timeframe: string
  interval: string
  candles: Array<{
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
}

const SUPPORTED_QCAP_TIMEFRAMES = new Set(["30m, 1h", "2h", "4h", "1d", "3d", "1w"])

function normalizeQcapTimeframe(timeframe: string = "1d"): string {
  const normalized = String(timeframe || "1d").trim().toLowerCase()

  if (SUPPORTED_QCAP_TIMEFRAMES.has(normalized)) {
    return normalized
  }

  // Temporary safe fallback until synthetic 3D / 1W aggregation is added.
  if (normalized === "3d" || normalized === "1w" || normalized === "1m") {
    return "1d"
  }

  // 8h is unsupported upstream and not part of Porta's target QCAP set.
  return "1d"
}

function toNumber(value: string | number): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function transformQubicCandles(data: QubicCandle[]): ChartCandle[] {
  return data
    .map((c) => {
      const time = Math.floor(Number(c.openTime) / 1000)
      const open = toNumber(c.open)
      const high = toNumber(c.high)
      const low = toNumber(c.low)
      const close = toNumber(c.close)
      const volume = toNumber(c.volume)

      if (
        !Number.isFinite(time) ||
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        volume === null
      ) {
        return null
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
    .filter((candle): candle is ChartCandle => candle !== null)
    .sort((a, b) => a.time - b.time)
}

export async function fetchQubicCandles(
  timeframe: string = "1d"
): Promise<ChartCandle[]> {
  const safeTimeframe = normalizeQcapTimeframe(timeframe)

  const res = await fetch(`/api/qubic/qcap-candles?timeframe=${safeTimeframe}`)

  if (!res.ok) {
    throw new Error(`Failed to fetch QCAP candles: ${res.status}`)
  }

  const parsed = (await res.json()) as CandleRouteResponse

  if (!parsed || !Array.isArray(parsed.candles)) {
    return []
  }

  return parsed.candles
    .map((c) => {
      const time = Number(c.time)
      const open = toNumber(c.open)
      const high = toNumber(c.high)
      const low = toNumber(c.low)
      const close = toNumber(c.close)
      const volume = toNumber(c.volume)

      if (
        !Number.isFinite(time) ||
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        volume === null
      ) {
        return null
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
    .filter((candle): candle is ChartCandle => candle !== null)
    .sort((a, b) => a.time - b.time)
}