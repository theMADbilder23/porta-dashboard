export function calculateRSI(
  closes: number[],
  period: number = 14
): number[] {
  if (closes.length < period + 1) return []

  const rsi: number[] = []
  let gains = 0
  let losses = 0

  // First average
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change >= 0) gains += change
    else losses += Math.abs(change)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  rsi.push(100 - 100 / (1 + avgGain / avgLoss))

  // Smooth RSI
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]

    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }

    const rs = avgGain / avgLoss
    rsi.push(100 - 100 / (1 + rs))
  }

  return rsi
}