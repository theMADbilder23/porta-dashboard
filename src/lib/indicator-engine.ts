export function computeIndicators(candles) {
  const closes = candles.map(c => c.close)

  const rsi = calculateRSI(closes)
  const macd = calculateMACD(closes)
  const stoch = calculateStochRSI(closes)

  return {
    rsi: rsi.at(-1),
    stoch_k: stoch.k.at(-1),
    stoch_d: stoch.d.at(-1),
    macd: macd.macd.at(-1),
    macd_signal: macd.signal.at(-1),
    macd_histogram: macd.histogram.at(-1),
  }
}