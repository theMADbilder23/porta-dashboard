"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type LineData,
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts"
import { type ChartCandle } from "@/lib/qubic/qcap-chart"
import { calculateRSI } from "@/lib/indicators/rsi"

type ErrorPayload = {
  error?: string
  message?: string
  status?: number
  contentType?: string
  preview?: string
  rawCount?: number
}

type BiasState = {
  label: string
  valueClassName: string
  note: string
}

type TimeframeOption = {
  key: string
  label: string
  minCandles: number
}

type CandleRouteResponse = {
  timeframe: string
  interval: string
  days: number
  candles: ChartCandle[]
}

type QcapCustomChartProps = {
  liveUsdPrice?: number
}

type MacdResult = {
  macd: number[]
  signal: number[]
  histogram: number[]
}

const TIMEFRAMES: TimeframeOption[] = [
  { key: "30m", label: "30M", minCandles: 120 },
  { key: "1h", label: "1H", minCandles: 120 },
  { key: "2h", label: "2H", minCandles: 120 },
  { key: "4h", label: "4H", minCandles: 120 },
  { key: "8h", label: "8H", minCandles: 120 },
  { key: "1d", label: "1D", minCandles: 120 },
]

const MIN_CANDLES_FOR_INDICATORS = 120
const RSI_PERIOD = 14
const STOCH_PERIOD = 14
const STOCH_SMOOTH_K = 3
const STOCH_SMOOTH_D = 3

const PRICE_CHART_HEIGHT = 280
const INDICATOR_CHART_HEIGHT = 95

function formatQcapPrice(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })
}

function formatVolume(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })
}

function formatDateFromUnix(time: number): string {
  return new Date(time * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatUsdCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"

  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }

  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }

  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`
  }

  if (abs >= 1) {
    return `$${value.toFixed(2)}`
  }

  return `$${value.toFixed(4)}`
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

function calculateMACD(closes: number[]): MacdResult {
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

  return { macd, signal, histogram }
}

function calculateStochRSI(
  closes: number[],
  rsiPeriod: number = RSI_PERIOD,
  stochPeriod: number = STOCH_PERIOD,
  smoothK: number = STOCH_SMOOTH_K,
  smoothD: number = STOCH_SMOOTH_D
) {
  const rsiValues = calculateRSI(closes, rsiPeriod)

  if (rsiValues.length < stochPeriod) {
    return {
      k: [] as number[],
      d: [] as number[],
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

  return { k, d, kOffset, dOffset }
}

function toCandlestickData(data: ChartCandle[]): CandlestickData<UTCTimestamp>[] {
  return data.map((candle) => ({
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }))
}

function toVolumeData(data: ChartCandle[]): HistogramData<UTCTimestamp>[] {
  return data.map((candle) => ({
    time: candle.time as UTCTimestamp,
    value: candle.volume,
    color: candle.close >= candle.open ? "#22c55e" : "#ef4444",
  }))
}

function toRsiLineData(
  data: ChartCandle[],
  period: number
): LineData<UTCTimestamp>[] {
  const closes = data.map((candle) => candle.close)
  const rsiValues = calculateRSI(closes, period)

  return rsiValues.map((value, index) => {
    const candle = data[index + period]
    return {
      time: candle.time as UTCTimestamp,
      value,
    }
  })
}

function toStochLineData(
  data: ChartCandle[],
  values: number[],
  offset: number
): LineData<UTCTimestamp>[] {
  return values
    .map((value, index) => {
      const candle = data[index + offset]
      if (!candle) return null

      return {
        time: candle.time as UTCTimestamp,
        value,
      }
    })
    .filter((point): point is LineData<UTCTimestamp> => point !== null)
}

function toMacdLineData(
  data: ChartCandle[],
  values: number[]
): LineData<UTCTimestamp>[] {
  return values
    .map((value, index) => {
      const candle = data[index]
      if (!candle || !Number.isFinite(value)) return null

      return {
        time: candle.time as UTCTimestamp,
        value,
      }
    })
    .filter((point): point is LineData<UTCTimestamp> => point !== null)
}

function toMacdHistogramData(
  data: ChartCandle[],
  values: number[]
): HistogramData<UTCTimestamp>[] {
  return values
    .map((value, index) => {
      const candle = data[index]
      if (!candle || !Number.isFinite(value)) return null

      return {
        time: candle.time as UTCTimestamp,
        value,
        color: value >= 0 ? "#67e8f9" : "#fca5a5",
      }
    })
    .filter(
      (point): point is HistogramData<UTCTimestamp> => point !== null
    )
}

function getRsiState(value: number | null): BiasState {
  if (value === null) {
    return {
      label: "Unavailable",
      valueClassName: "text-slate-400",
      note: "Not enough data for RSI yet.",
    }
  }

  if (value >= 70) {
    return {
      label: "Overbought",
      valueClassName: "text-red-400",
      note: "Momentum is elevated.",
    }
  }

  if (value <= 30) {
    return {
      label: "Oversold",
      valueClassName: "text-emerald-400",
      note: "Momentum is compressed.",
    }
  }

  return {
    label: "Neutral",
    valueClassName: "text-slate-300",
    note: "Momentum is balanced.",
  }
}

function getStochState(k: number | null, d: number | null): BiasState {
  if (k === null || d === null) {
    return {
      label: "Unavailable",
      valueClassName: "text-slate-400",
      note: "Not enough data for Stoch RSI yet.",
    }
  }

  if (k >= 80 && d >= 80) {
    return {
      label: "Overbought",
      valueClassName: "text-red-400",
      note: "Short-term momentum is stretched.",
    }
  }

  if (k <= 20 && d <= 20) {
    return {
      label: "Oversold",
      valueClassName: "text-emerald-400",
      note: "Short-term momentum is compressed.",
    }
  }

  return {
    label: "Neutral",
    valueClassName: "text-slate-300",
    note: "Short-term momentum is balanced.",
  }
}

function getSignalBiasV2(
  latestRsi: number | null,
  latestStochK: number | null,
  latestStochD: number | null
): BiasState {
  if (latestRsi === null || latestStochK === null || latestStochD === null) {
    return {
      label: "Neutral",
      valueClassName: "text-slate-300",
      note: "Waiting for stronger indicator context.",
    }
  }

  const stochBullish = latestStochK > latestStochD && latestStochK > 50
  const stochBearish = latestStochK < latestStochD && latestStochK < 50

  if (latestRsi >= 55 && stochBullish) {
    return {
      label: "Bullish",
      valueClassName: "text-emerald-400",
      note: "RSI and Stoch RSI both support upward momentum.",
    }
  }

  if (latestRsi <= 45 && stochBearish) {
    return {
      label: "Bearish",
      valueClassName: "text-red-400",
      note: "RSI and Stoch RSI both support weakening momentum.",
    }
  }

  return {
    label: "Neutral",
    valueClassName: "text-slate-300",
    note: "Momentum is mixed and not strongly directional.",
  }
}

function getDefaultSupportedTimeframe(
  key: string,
  supportedTimeframes: string[]
): string {
  if (supportedTimeframes.includes(key)) return key
  return supportedTimeframes[supportedTimeframes.length - 1] || "1d"
}

function sumRecentVolume(data: ChartCandle[], count: number): number | null {
  if (!data.length) return null
  const slice = data.slice(-count)
  return slice.reduce((sum, candle) => sum + candle.volume, 0)
}

function deriveUsdPerQu(
  liveUsdPrice: number | undefined,
  latestCandle: ChartCandle | null
): number | null {
  if (!liveUsdPrice || !latestCandle || !latestCandle.close) return null
  return liveUsdPrice / latestCandle.close
}

function convertQuValueToUsd(
  quValue: number,
  usdPerQu: number | null
): number | null {
  if (usdPerQu === null) return null
  return quValue * usdPerQu
}

export default function QcapCustomChart({
  liveUsdPrice,
}: QcapCustomChartProps) {
  const [data, setData] = useState<ChartCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredCandle, setHoveredCandle] = useState<ChartCandle | null>(null)
  const [timeframe, setTimeframe] = useState<string>("8h")
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false)

  const priceContainerRef = useRef<HTMLDivElement | null>(null)
  const rsiContainerRef = useRef<HTMLDivElement | null>(null)
  const macdContainerRef = useRef<HTMLDivElement | null>(null)
  const stochContainerRef = useRef<HTMLDivElement | null>(null)
  const timeframeMenuRef = useRef<HTMLDivElement | null>(null)

  const priceChartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const macdChartRef = useRef<IChartApi | null>(null)
  const stochChartRef = useRef<IChartApi | null>(null)

  const syncingFromPriceRef = useRef(false)
  const syncingFromRsiRef = useRef(false)
  const syncingFromMacdRef = useRef(false)
  const syncingFromStochRef = useRef(false)

  const supportedTimeframes = useMemo(() => ["8h", "1d"], [])

  useEffect(() => {
    const safeTimeframe = getDefaultSupportedTimeframe(
      timeframe,
      supportedTimeframes
    )

    if (safeTimeframe !== timeframe) {
      setTimeframe(safeTimeframe)
    }
  }, [timeframe, supportedTimeframes])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        timeframeMenuRef.current &&
        !timeframeMenuRef.current.contains(event.target as Node)
      ) {
        setShowTimeframeMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/qubic/qcap-candles?timeframe=${timeframe}`)

        if (!res.ok) {
          let payload: ErrorPayload | null = null

          try {
            payload = await res.json()
          } catch {
            payload = null
          }

          const message =
            payload?.message ||
            payload?.error ||
            `Failed to load QCAP data (${res.status})`

          throw new Error(message)
        }

        const payload = (await res.json()) as CandleRouteResponse

        if (!payload || !Array.isArray(payload.candles)) {
          throw new Error("QCAP route did not return a candles array")
        }

        if (!isMounted) return

        setData(payload.candles)
        setHoveredCandle(null)
      } catch (err) {
        if (!isMounted) return

        setData([])
        setError(err instanceof Error ? err.message : "Failed to load QCAP data")
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [timeframe])

  const hasEnoughHistoryForIndicators = useMemo(
    () => data.length >= MIN_CANDLES_FOR_INDICATORS,
    [data]
  )

  const latestCandle = useMemo(
    () => (data.length ? data[data.length - 1] : null),
    [data]
  )

  const tooltipCandle = hoveredCandle ?? latestCandle

  const usdPerQu = useMemo(
    () => deriveUsdPerQu(liveUsdPrice, latestCandle),
    [liveUsdPrice, latestCandle]
  )

  const rsiLineData = useMemo(() => {
    if (!hasEnoughHistoryForIndicators || !data.length) return []
    return toRsiLineData(data, RSI_PERIOD)
  }, [data, hasEnoughHistoryForIndicators])

  const stochData = useMemo(() => {
    if (!hasEnoughHistoryForIndicators || !data.length) {
      return {
        kLineData: [] as LineData<UTCTimestamp>[],
        dLineData: [] as LineData<UTCTimestamp>[],
      }
    }

    const closes = data.map((candle) => candle.close)
    const { k, d, kOffset, dOffset } = calculateStochRSI(closes)

    return {
      kLineData: toStochLineData(data, k, kOffset),
      dLineData: toStochLineData(data, d, dOffset),
    }
  }, [data, hasEnoughHistoryForIndicators])

  const macdData = useMemo(() => {
    if (!data.length) {
      return {
        macdLineData: [] as LineData<UTCTimestamp>[],
        signalLineData: [] as LineData<UTCTimestamp>[],
        histogramData: [] as HistogramData<UTCTimestamp>[],
        latestMacd: null as number | null,
        latestSignal: null as number | null,
        latestHistogram: null as number | null,
      }
    }

    const closes = data.map((candle) => candle.close)
    const { macd, signal, histogram } = calculateMACD(closes)

    const macdLineData = toMacdLineData(data, macd)
    const signalLineData = toMacdLineData(data, signal)
    const histogramData = toMacdHistogramData(data, histogram)

    return {
      macdLineData,
      signalLineData,
      histogramData,
      latestMacd: macd.length ? macd[macd.length - 1] : null,
      latestSignal: signal.length ? signal[signal.length - 1] : null,
      latestHistogram: histogram.length ? histogram[histogram.length - 1] : null,
    }
  }, [data])

  const latestRsi = useMemo(() => {
    if (!rsiLineData.length) return null
    return rsiLineData[rsiLineData.length - 1].value ?? null
  }, [rsiLineData])

  const latestStochK = useMemo(() => {
    if (!stochData.kLineData.length) return null
    return stochData.kLineData[stochData.kLineData.length - 1].value ?? null
  }, [stochData])

  const latestStochD = useMemo(() => {
    if (!stochData.dLineData.length) return null
    return stochData.dLineData[stochData.dLineData.length - 1].value ?? null
  }, [stochData])

  const tooltipRsi = useMemo(() => {
    if (!tooltipCandle || !rsiLineData.length) return null

    const match = rsiLineData.find(
      (point) => Number(point.time) === tooltipCandle.time
    )

    return match?.value ?? null
  }, [tooltipCandle, rsiLineData])

  const tooltipStochK = useMemo(() => {
    if (!tooltipCandle || !stochData.kLineData.length) return null

    const match = stochData.kLineData.find(
      (point) => Number(point.time) === tooltipCandle.time
    )

    return match?.value ?? null
  }, [tooltipCandle, stochData])

  const tooltipStochD = useMemo(() => {
    if (!tooltipCandle || !stochData.dLineData.length) return null

    const match = stochData.dLineData.find(
      (point) => Number(point.time) === tooltipCandle.time
    )

    return match?.value ?? null
  }, [tooltipCandle, stochData])

  const tooltipMacd = useMemo(() => {
    if (!tooltipCandle || !macdData.macdLineData.length) return null

    const match = macdData.macdLineData.find(
      (point) => Number(point.time) === tooltipCandle.time
    )

    return match?.value ?? null
  }, [tooltipCandle, macdData])

  const tooltipMacdSignal = useMemo(() => {
    if (!tooltipCandle || !macdData.signalLineData.length) return null

    const match = macdData.signalLineData.find(
      (point) => Number(point.time) === tooltipCandle.time
    )

    return match?.value ?? null
  }, [tooltipCandle, macdData])

  const rsiState = useMemo(() => getRsiState(latestRsi), [latestRsi])

  const stochState = useMemo(
    () => getStochState(latestStochK, latestStochD),
    [latestStochK, latestStochD]
  )

  const signalBias = useMemo(
    () => getSignalBiasV2(latestRsi, latestStochK, latestStochD),
    [latestRsi, latestStochK, latestStochD]
  )

  const oneHourVolume = useMemo(() => {
    if (!data.length) return null

    if (timeframe === "1d") return null
    if (timeframe === "8h") return null
    if (timeframe === "4h") return null

    if (timeframe === "2h") {
      return sumRecentVolume(data, 1)
    }

    if (timeframe === "1h") {
      return sumRecentVolume(data, 1)
    }

    if (timeframe === "30m") {
      return sumRecentVolume(data, 2)
    }

    return null
  }, [data, timeframe])

  const twentyFourHourVolume = useMemo(() => {
    if (!data.length) return null

    if (timeframe === "1d") {
      return sumRecentVolume(data, 1)
    }

    if (timeframe === "8h") {
      return sumRecentVolume(data, 3)
    }

    if (timeframe === "4h") {
      return sumRecentVolume(data, 6)
    }

    if (timeframe === "2h") {
      return sumRecentVolume(data, 12)
    }

    if (timeframe === "1h") {
      return sumRecentVolume(data, 24)
    }

    if (timeframe === "30m") {
      return sumRecentVolume(data, 48)
    }

    return null
  }, [data, timeframe])

  const oneHourVolumeUsd = useMemo(
    () =>
      oneHourVolume !== null
        ? convertQuValueToUsd(oneHourVolume, usdPerQu)
        : null,
    [oneHourVolume, usdPerQu]
  )

  const twentyFourHourVolumeUsd = useMemo(
    () =>
      twentyFourHourVolume !== null
        ? convertQuValueToUsd(twentyFourHourVolume, usdPerQu)
        : null,
    [twentyFourHourVolume, usdPerQu]
  )

  useEffect(() => {
    if (
      !priceContainerRef.current ||
      !rsiContainerRef.current ||
      !macdContainerRef.current ||
      !stochContainerRef.current ||
      !data.length
    ) {
      return
    }

    priceChartRef.current?.remove()
    rsiChartRef.current?.remove()
    macdChartRef.current?.remove()
    stochChartRef.current?.remove()

    const priceContainer = priceContainerRef.current
    const rsiContainer = rsiContainerRef.current
    const macdContainer = macdContainerRef.current
    const stochContainer = stochContainerRef.current

    const commonLayout = {
      layout: {
        background: { type: ColorType.Solid as const, color: "#050816" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(168, 85, 247, 0.45)",
          width: 1,
        },
        horzLine: {
          color: "rgba(168, 85, 247, 0.45)",
          width: 1,
        },
      },
    }

    const priceChart = createChart(priceContainer, {
      width: priceContainer.clientWidth,
      height: PRICE_CHART_HEIGHT,
      ...commonLayout,
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        scaleMargins: {
          top: 0.08,
          bottom: 0.24,
        },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: false,
        visible: false,
      },
      localization: {
        priceFormatter: (price: number) => formatQcapPrice(price),
      },
    })

    const rsiChart = createChart(rsiContainer, {
      width: rsiContainer.clientWidth,
      height: INDICATOR_CHART_HEIGHT,
      ...commonLayout,
      rightPriceScale: {
        visible: true,
        borderColor: "rgba(148, 163, 184, 0.12)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: false,
        visible: false,
      },
      localization: {
        priceFormatter: (price: number) =>
          price.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      },
    })

    const macdChart = createChart(macdContainer, {
      width: macdContainer.clientWidth,
      height: INDICATOR_CHART_HEIGHT,
      ...commonLayout,
      rightPriceScale: {
        visible: true,
        borderColor: "rgba(148, 163, 184, 0.12)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: false,
        visible: false,
      },
      localization: {
        priceFormatter: (price: number) =>
          price.toLocaleString("en-US", { maximumFractionDigits: 6 }),
      },
    })

    const stochChart = createChart(stochContainer, {
      width: stochContainer.clientWidth,
      height: INDICATOR_CHART_HEIGHT,
      ...commonLayout,
      rightPriceScale: {
        visible: true,
        borderColor: "rgba(148, 163, 184, 0.12)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price: number) =>
          price.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      },
    })

    const candleSeries = priceChart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: false,
    })

    const volumeSeries = priceChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderColor: "rgba(148, 163, 184, 0.12)",
    })

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const macdHistogramSeries = macdChart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const macdLineSeries = macdChart.addSeries(LineSeries, {
      color: "#60a5fa",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const macdSignalSeries = macdChart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const stochKSeries = stochChart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const stochDSeries = stochChart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    candleSeries.setData(toCandlestickData(data))
    volumeSeries.setData(toVolumeData(data))
    rsiSeries.setData(rsiLineData)
    macdHistogramSeries.setData(macdData.histogramData)
    macdLineSeries.setData(macdData.macdLineData)
    macdSignalSeries.setData(macdData.signalLineData)
    stochKSeries.setData(stochData.kLineData)
    stochDSeries.setData(stochData.dLineData)

    ;[
      { series: rsiSeries, price: 70, color: "#ef4444" },
      { series: rsiSeries, price: 50, color: "#94a3b8" },
      { series: rsiSeries, price: 30, color: "#22c55e" },
    ].forEach(({ series, price, color }) => {
      series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "",
      })
    })

    ;[
      { series: stochKSeries, price: 80, color: "#ef4444" },
      { series: stochKSeries, price: 50, color: "#94a3b8" },
      { series: stochKSeries, price: 20, color: "#22c55e" },
    ].forEach(({ series, price, color }) => {
      series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "",
      })
    })

    macdLineSeries.createPriceLine({
      price: 0,
      color: "#94a3b8",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "",
    })

    priceChart.timeScale().fitContent()
    rsiChart.timeScale().fitContent()
    macdChart.timeScale().fitContent()
    stochChart.timeScale().fitContent()

    priceChart.timeScale().subscribeVisibleLogicalRangeChange(
      (range: LogicalRange | null) => {
        if (
          !range ||
          syncingFromRsiRef.current ||
          syncingFromMacdRef.current ||
          syncingFromStochRef.current
        ) {
          return
        }

        syncingFromPriceRef.current = true
        rsiChartRef.current?.timeScale().setVisibleLogicalRange(range)
        macdChartRef.current?.timeScale().setVisibleLogicalRange(range)
        stochChartRef.current?.timeScale().setVisibleLogicalRange(range)
        syncingFromPriceRef.current = false
      }
    )

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(
      (range: LogicalRange | null) => {
        if (
          !range ||
          syncingFromPriceRef.current ||
          syncingFromMacdRef.current ||
          syncingFromStochRef.current
        ) {
          return
        }

        syncingFromRsiRef.current = true
        priceChartRef.current?.timeScale().setVisibleLogicalRange(range)
        macdChartRef.current?.timeScale().setVisibleLogicalRange(range)
        stochChartRef.current?.timeScale().setVisibleLogicalRange(range)
        syncingFromRsiRef.current = false
      }
    )

    macdChart.timeScale().subscribeVisibleLogicalRangeChange(
      (range: LogicalRange | null) => {
        if (
          !range ||
          syncingFromPriceRef.current ||
          syncingFromRsiRef.current ||
          syncingFromStochRef.current
        ) {
          return
        }

        syncingFromMacdRef.current = true
        priceChartRef.current?.timeScale().setVisibleLogicalRange(range)
        rsiChartRef.current?.timeScale().setVisibleLogicalRange(range)
        stochChartRef.current?.timeScale().setVisibleLogicalRange(range)
        syncingFromMacdRef.current = false
      }
    )

    stochChart.timeScale().subscribeVisibleLogicalRangeChange(
      (range: LogicalRange | null) => {
        if (
          !range ||
          syncingFromPriceRef.current ||
          syncingFromRsiRef.current ||
          syncingFromMacdRef.current
        ) {
          return
        }

        syncingFromStochRef.current = true
        priceChartRef.current?.timeScale().setVisibleLogicalRange(range)
        rsiChartRef.current?.timeScale().setVisibleLogicalRange(range)
        macdChartRef.current?.timeScale().setVisibleLogicalRange(range)
        syncingFromStochRef.current = false
      }
    )

    const handleCrosshairMove = (param: { time?: Time }) => {
      if (!param.time) {
        setHoveredCandle(null)
        return
      }

      const hoveredTime = Number(param.time)
      const match = data.find((candle) => candle.time === hoveredTime) ?? null
      setHoveredCandle(match)
    }

    priceChart.subscribeCrosshairMove(handleCrosshairMove)
    rsiChart.subscribeCrosshairMove(handleCrosshairMove)
    macdChart.subscribeCrosshairMove(handleCrosshairMove)
    stochChart.subscribeCrosshairMove(handleCrosshairMove)

    priceChartRef.current = priceChart
    rsiChartRef.current = rsiChart
    macdChartRef.current = macdChart
    stochChartRef.current = stochChart

    const resizeObserver = new ResizeObserver(() => {
      if (priceContainerRef.current && priceChartRef.current) {
        priceChartRef.current.applyOptions({
          width: priceContainerRef.current.clientWidth,
          height: PRICE_CHART_HEIGHT,
        })
      }

      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: rsiContainerRef.current.clientWidth,
          height: INDICATOR_CHART_HEIGHT,
        })
      }

      if (macdContainerRef.current && macdChartRef.current) {
        macdChartRef.current.applyOptions({
          width: macdContainerRef.current.clientWidth,
          height: INDICATOR_CHART_HEIGHT,
        })
      }

      if (stochContainerRef.current && stochChartRef.current) {
        stochChartRef.current.applyOptions({
          width: stochContainerRef.current.clientWidth,
          height: INDICATOR_CHART_HEIGHT,
        })
      }
    })

    resizeObserver.observe(priceContainer)
    resizeObserver.observe(rsiContainer)
    resizeObserver.observe(macdContainer)
    resizeObserver.observe(stochContainer)

    return () => {
      resizeObserver.disconnect()
      priceChartRef.current?.remove()
      rsiChartRef.current?.remove()
      macdChartRef.current?.remove()
      stochChartRef.current?.remove()
      priceChartRef.current = null
      rsiChartRef.current = null
      macdChartRef.current = null
      stochChartRef.current = null
    }
  }, [data, rsiLineData, macdData, stochData])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-white/10 bg-black p-4 text-sm text-slate-400">
          Loading QCAP chart...
        </div>
      </div>
    )
  }

  if (error || !data.length) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-white/10 bg-black p-4 text-sm text-red-400">
          Failed to load QCAP data
          {error ? <div className="mt-2 text-xs text-slate-400">{error}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3" ref={timeframeMenuRef}>
        <button
          type="button"
          onClick={() => setShowTimeframeMenu((prev) => !prev)}
          className="rounded-md border border-white/10 bg-[#0b1020] px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-violet-400/40 hover:text-violet-300"
        >
          Timeframe:{" "}
          {TIMEFRAMES.find((option) => option.key === timeframe)?.label ??
            timeframe.toUpperCase()}{" "}
          ▾
        </button>

        {showTimeframeMenu ? (
          <div className="absolute z-20 mt-36 w-40 rounded-lg border border-white/10 bg-[#0b1020] p-1 shadow-xl">
            {TIMEFRAMES.map((option) => {
              const isActive = option.key === timeframe
              const isSupported = supportedTimeframes.includes(option.key)

              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={!isSupported}
                  onClick={() => {
                    if (!isSupported) return
                    setTimeframe(option.key)
                    setShowTimeframeMenu(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition ${
                    isActive
                      ? "bg-violet-500/15 text-violet-300"
                      : isSupported
                        ? "text-slate-300 hover:bg-white/5"
                        : "cursor-not-allowed text-slate-500"
                  }`}
                >
                  <span>{option.label}</span>
                  {!isSupported ? <span className="text-[10px]">Soon</span> : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span>Candles: {data.length}</span>
          <span>Timeframe: {timeframe.toUpperCase()}</span>
          {latestCandle ? (
            <span>
              Last Close: {formatQcapPrice(latestCandle.close)} QUs (
              {formatUsdCompact(convertQuValueToUsd(latestCandle.close, usdPerQu))})
            </span>
          ) : null}
        </div>

        <div>
          {hasEnoughHistoryForIndicators ? (
            <span className="text-emerald-500">Indicator history threshold passed</span>
          ) : (
            <span className="text-amber-500">
              Limited history — chart is valid, but custom indicators should stay
              disabled until at least {MIN_CANDLES_FOR_INDICATORS} candles are available
            </span>
          )}
        </div>
      </div>

      {!supportedTimeframes.includes(timeframe) ? (
        <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          This timeframe does not yet have enough reliable QCAP candle coverage. Use
          8H or 1D for now.
        </div>
      ) : null}

      {tooltipCandle ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-slate-400">
          <span>{formatDateFromUnix(tooltipCandle.time)}</span>
          <span>
            O: {formatQcapPrice(tooltipCandle.open)} QUs (
            {formatUsdCompact(convertQuValueToUsd(tooltipCandle.open, usdPerQu))})
          </span>
          <span>
            H: {formatQcapPrice(tooltipCandle.high)} QUs (
            {formatUsdCompact(convertQuValueToUsd(tooltipCandle.high, usdPerQu))})
          </span>
          <span>
            L: {formatQcapPrice(tooltipCandle.low)} QUs (
            {formatUsdCompact(convertQuValueToUsd(tooltipCandle.low, usdPerQu))})
          </span>
          <span>
            C: {formatQcapPrice(tooltipCandle.close)} QUs (
            {formatUsdCompact(convertQuValueToUsd(tooltipCandle.close, usdPerQu))})
          </span>
          <span>
            V: {formatVolume(tooltipCandle.volume)} QUs (
            {formatUsdCompact(convertQuValueToUsd(tooltipCandle.volume, usdPerQu))})
          </span>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded border border-white/10 bg-black shadow-inner">
        <div className="pointer-events-none absolute left-3 top-2 z-10 text-xs font-semibold text-slate-300">
          Price / Volume
        </div>

        <div
          className="pointer-events-none absolute left-3 z-10 text-xs font-semibold text-slate-300"
          style={{ top: `${PRICE_CHART_HEIGHT + 10}px` }}
        >
          RSI {tooltipRsi?.toFixed(2) ?? latestRsi?.toFixed(2) ?? "—"}
        </div>

        <div
          className="pointer-events-none absolute left-3 z-10 text-xs font-semibold text-slate-300"
          style={{ top: `${PRICE_CHART_HEIGHT + INDICATOR_CHART_HEIGHT + 16}px` }}
        >
          MACD {tooltipMacd?.toFixed(6) ?? macdData.latestMacd?.toFixed(6) ?? "—"} /{" "}
          {tooltipMacdSignal?.toFixed(6) ?? macdData.latestSignal?.toFixed(6) ?? "—"}
        </div>

        <div
          className="pointer-events-none absolute left-3 z-10 text-xs font-semibold text-slate-300"
          style={{
            top: `${PRICE_CHART_HEIGHT + INDICATOR_CHART_HEIGHT * 2 + 22}px`,
          }}
        >
          Stoch {tooltipStochK?.toFixed(2) ?? latestStochK?.toFixed(2) ?? "—"} /{" "}
          {tooltipStochD?.toFixed(2) ?? latestStochD?.toFixed(2) ?? "—"}
        </div>

        <div
          ref={priceContainerRef}
          className="w-full"
          style={{ height: `${PRICE_CHART_HEIGHT}px` }}
        />
        <div className="border-t border-white/10" />
        <div
          ref={rsiContainerRef}
          className="w-full"
          style={{ height: `${INDICATOR_CHART_HEIGHT}px` }}
        />
        <div className="border-t border-white/10" />
        <div
          ref={macdContainerRef}
          className="w-full"
          style={{ height: `${INDICATOR_CHART_HEIGHT}px` }}
        />
        <div className="border-t border-white/10" />
        <div
          ref={stochContainerRef}
          className="w-full"
          style={{ height: `${INDICATOR_CHART_HEIGHT}px` }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2 desktop:grid-cols-6">
        <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            RSI
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {latestRsi !== null ? latestRsi.toFixed(2) : "—"}
          </p>
          <p className="mt-2 text-sm font-medium text-[#BFA9F5] dark:text-[#BFA9F5]">
            {rsiState.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            {rsiState.note}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Stoch RSI
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {latestStochK !== null && latestStochD !== null
              ? `${latestStochK.toFixed(2)} / ${latestStochD.toFixed(2)}`
              : "—"}
          </p>
          <p className="mt-2 text-sm font-medium text-[#BFA9F5] dark:text-[#BFA9F5]">
            {stochState.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            {stochState.note}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            MACD
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {macdData.latestMacd !== null ? macdData.latestMacd.toFixed(6) : "—"}
          </p>
          <p className="mt-2 text-sm font-medium text-[#BFA9F5] dark:text-[#BFA9F5]">
            {macdData.latestHistogram !== null && macdData.latestHistogram >= 0
              ? "Bullish Cross Pressure"
              : "Bearish Cross Pressure"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            Signal {macdData.latestSignal !== null ? macdData.latestSignal.toFixed(6) : "—"} • Histogram{" "}
            {macdData.latestHistogram !== null ? macdData.latestHistogram.toFixed(6) : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Signal Bias
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#6D28D9] dark:text-[#D8B4FE]">
            {signalBias.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            {signalBias.note}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            1H Volume
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {oneHourVolume !== null ? formatVolume(oneHourVolume) : "—"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            {oneHourVolumeUsd !== null
              ? `Short-term momentum volume. (${formatUsdCompact(oneHourVolumeUsd)})`
              : "Short-term momentum volume."}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            24H Volume
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
            {twentyFourHourVolume !== null ? formatVolume(twentyFourHourVolume) : "—"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
            {twentyFourHourVolumeUsd !== null
              ? `Rolling 24H activity volume. (${formatUsdCompact(twentyFourHourVolumeUsd)})`
              : "Rolling 24H activity volume."}
          </p>
        </div>
      </div>
    </div>
  )
}