export type MacdResult = {
  macd: number[]
  signal: number[]
  histogram: number[]
}

function ema(values: number[], period: number): number[] {
  if (!values.length) return []

  const k = 2 / (period + 1)
  const out: number[] = [values[0]]

  for (let i = 1; i < values.length; i++) {
    const next = values[i] * k + out[i - 1] * (1 - k)
    out.push(next)
  }

  return out
}

export function calculateMACD(closes: number[]): MacdResult {
  if (!closes.length) {
    return {
      macd: [],
      signal: [],
      histogram: [],
    }
  }

  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)

  const macd = ema12.map((value, index) => value - ema26[index])
  const signal = ema(macd, 9)
  const histogram = macd.map((value, index) => value - signal[index])

  return {
    macd,
    signal,
    histogram,
  }
}