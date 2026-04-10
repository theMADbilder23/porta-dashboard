import { calculateRSI } from "@/lib/indicators/rsi"
import { calculateMACD } from "@/lib/indicators/macd"
import { calculateStochRSI } from "@/lib/indicators/stoch"
import type { ChartCandle } from "@/lib/market/types"

export type ComputedIndicators = {
  rsi: number | null
  stoch_k: number | null
  stoch_d: number | null
  macd: number | null
  macd_signal: number | null
  macd_histogram: number | null
}

export function computeIndicators(
  candles: ChartCandle[]
): ComputedIndicators {
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      rsi: null,
      stoch_k: null,
      stoch_d: null,
      macd: null,
      macd_signal: null,
      macd_histogram: null,
    }
  }

  const closes = candles.map((candle) => candle.close)

  const rsi = calculateRSI(closes)
  const macd = calculateMACD(closes)
  const stoch = calculateStochRSI(closes)

  return {
    rsi: rsi.at(-1) ?? null,
    stoch_k: stoch.k.at(-1) ?? null,
    stoch_d: stoch.d.at(-1) ?? null,
    macd: macd.macd.at(-1) ?? null,
    macd_signal: macd.signal.at(-1) ?? null,
    macd_histogram: macd.histogram.at(-1) ?? null,
  }
}