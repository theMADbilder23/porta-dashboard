import { calculateRSI } from "@/lib/indicators/rsi"

export type StochRsiResult = {
  k: number[]
  d: number[]
  kOffset: number
  dOffset: number
}

function sma(values: number[], period: number): number[] {
  if (values.length < period) return []

  const out: number[] = []

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const avg = slice.reduce((sum, value) => sum + value, 0) / period
    out.push(avg)
  }

  return out
}

export function calculateStochRSI(
  closes: number[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): StochRsiResult {
  const rsiValues = calculateRSI(closes, rsiPeriod)

  if (rsiValues.length < stochPeriod) {
    return {
      k: [],
      d: [],
      kOffset: 0,
      dOffset: 0,
    }
  }

  const rawStoch: number[] = []

  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1)
    const minRsi = Math.min(...window)
    const maxRsi = Math.max(...window)
    const currentRsi = rsiValues[i]

    if (maxRsi === minRsi) {
      rawStoch.push(50)
    } else {
      rawStoch.push(((currentRsi - minRsi) / (maxRsi - minRsi)) * 100)
    }
  }

  const k = sma(rawStoch, smoothK)
  const d = sma(k, smoothD)

  const rawOffset = rsiPeriod + (stochPeriod - 1)
  const kOffset = rawOffset + (smoothK - 1)
  const dOffset = kOffset + (smoothD - 1)

  return {
    k,
    d,
    kOffset,
    dOffset,
  }
}