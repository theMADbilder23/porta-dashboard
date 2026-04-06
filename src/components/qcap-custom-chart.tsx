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
  type ISeriesApi,
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

const MIN_CANDLES_FOR_INDICATORS = 120
const RSI_PERIOD = 14

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

function toCandlestickData(data: ChartCandle[]): CandlestickData<UTCTimestamp>[] {
  return data.map((candle) => ({
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }))
}

function toVolumeData(data: ChartCandle[]): HistogramData<Time>[] {
  return data.map((candle) => ({
    time: candle.time as UTCTimestamp,
    value: candle.volume,
    color: candle.close >= candle.open ? "#22c55e" : "#ef4444",
  }))
}

function toRsiLineData(data: ChartCandle[], period: number): LineData<UTCTimestamp>[] {
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

function getRsiState(value: number | null) {
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

function getSignalBiasV1(data: ChartCandle[], rsiLineData: LineData<UTCTimestamp>[]): BiasState {
  if (data.length < 10 || rsiLineData.length < 5) {
    return {
      label: "Neutral",
      valueClassName: "text-slate-300",
      note: "Waiting for stronger indicator context.",
    }
  }

  const latestRsi = rsiLineData[rsiLineData.length - 1]?.value ?? null
  const prevRsi = rsiLineData[rsiLineData.length - 4]?.value ?? null

  if (latestRsi === null || prevRsi === null) {
    return {
      label: "Neutral",
      valueClassName: "text-slate-300",
      note: "Waiting for stronger indicator context.",
    }
  }

  const latestClose = data[data.length - 1].close
  const lookbackClose = data[data.length - 5].close

  const rsiSlope = latestRsi - prevRsi
  const priceChangePct =
    lookbackClose !== 0 ? ((latestClose - lookbackClose) / lookbackClose) * 100 : 0

  const rsiRising = rsiSlope > 1.5
  const rsiFalling = rsiSlope < -1.5
  const priceRising = priceChangePct > 1
  const priceFalling = priceChangePct < -1

  if (latestRsi >= 55 && (rsiRising || priceRising)) {
    return {
      label: "Bullish",
      valueClassName: "text-emerald-400",
      note: "Momentum is improving with supportive price action.",
    }
  }

  if (latestRsi <= 45 && (rsiFalling || priceFalling)) {
    return {
      label: "Bearish",
      valueClassName: "text-red-400",
      note: "Momentum is weakening with softer recent price action.",
    }
  }

  return {
    label: "Neutral",
    valueClassName: "text-slate-300",
    note: "Momentum is mixed and not strongly directional.",
  }
}

export default function QcapCustomChart() {
  const [data, setData] = useState<ChartCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredCandle, setHoveredCandle] = useState<ChartCandle | null>(null)

  const priceContainerRef = useRef<HTMLDivElement | null>(null)
  const rsiContainerRef = useRef<HTMLDivElement | null>(null)

  const priceChartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)

  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)

  const syncingFromPriceRef = useRef(false)
  const syncingFromRsiRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch("/api/qubic/qcap-candles")

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

        const candles = await res.json()

        if (!Array.isArray(candles)) {
          throw new Error("QCAP route did not return an array")
        }

        if (!isMounted) return
        setData(candles)
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
  }, [])

  const hasEnoughHistoryForIndicators = useMemo(() => {
    return data.length >= MIN_CANDLES_FOR_INDICATORS
  }, [data])

  const latestCandle = useMemo(() => {
    return data.length ? data[data.length - 1] : null
  }, [data])

  const tooltipCandle = hoveredCandle ?? latestCandle

  const rsiLineData = useMemo(() => {
    if (!hasEnoughHistoryForIndicators || !data.length) return []
    return toRsiLineData(data, RSI_PERIOD)
  }, [data, hasEnoughHistoryForIndicators])

  const latestRsi = useMemo(() => {
    if (!rsiLineData.length) return null
    return rsiLineData[rsiLineData.length - 1].value ?? null
  }, [rsiLineData])

  const tooltipRsi = useMemo(() => {
    if (!tooltipCandle || !rsiLineData.length) return null

    const match = rsiLineData.find(
      (point) => Number(point.time) === tooltipCandle.time
    )

    return match?.value ?? null
  }, [tooltipCandle, rsiLineData])

  const rsiState = useMemo(() => getRsiState(latestRsi), [latestRsi])
  const signalBias = useMemo(() => getSignalBiasV1(data, rsiLineData), [data, rsiLineData])

  useEffect(() => {
    if (!priceContainerRef.current || !rsiContainerRef.current || !data.length) return

    if (priceChartRef.current) {
      priceChartRef.current.remove()
      priceChartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }

    if (rsiChartRef.current) {
      rsiChartRef.current.remove()
      rsiChartRef.current = null
      rsiSeriesRef.current = null
    }

    const priceContainer = priceContainerRef.current
    const rsiContainer = rsiContainerRef.current

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
      height: 340,
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
      height: 120,
      ...commonLayout,
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
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
      lastValueVisible: true,
    })

    const volumeSeries = priceChart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.80,
        bottom: 0,
      },
      borderColor: "rgba(148, 163, 184, 0.12)",
    })

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    candleSeries.setData(toCandlestickData(data))
    volumeSeries.setData(toVolumeData(data))
    rsiSeries.setData(rsiLineData)

    rsiSeries.createPriceLine({
      price: 70,
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "70",
    })

    rsiSeries.createPriceLine({
      price: 50,
      color: "#94a3b8",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "50",
    })

    rsiSeries.createPriceLine({
      price: 30,
      color: "#22c55e",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "30",
    })

    priceChart.timeScale().fitContent()
    rsiChart.timeScale().fitContent()

    priceChart.timeScale().subscribeVisibleLogicalRangeChange((range: LogicalRange | null) => {
      if (!range || !rsiChartRef.current || syncingFromRsiRef.current) return

      syncingFromPriceRef.current = true
      rsiChartRef.current.timeScale().setVisibleLogicalRange(range)
      syncingFromPriceRef.current = false
    })

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range: LogicalRange | null) => {
      if (!range || !priceChartRef.current || syncingFromPriceRef.current) return

      syncingFromRsiRef.current = true
      priceChartRef.current.timeScale().setVisibleLogicalRange(range)
      syncingFromRsiRef.current = false
    })

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

    priceChartRef.current = priceChart
    rsiChartRef.current = rsiChart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    rsiSeriesRef.current = rsiSeries

    const resizeObserver = new ResizeObserver(() => {
      if (priceContainerRef.current && priceChartRef.current) {
        priceChartRef.current.applyOptions({
          width: priceContainerRef.current.clientWidth,
          height: 340,
        })
      }

      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: rsiContainerRef.current.clientWidth,
          height: 120,
        })
      }
    })

    resizeObserver.observe(priceContainer)
    resizeObserver.observe(rsiContainer)

    return () => {
      resizeObserver.disconnect()

      if (priceChartRef.current) {
        priceChartRef.current.remove()
        priceChartRef.current = null
        candleSeriesRef.current = null
        volumeSeriesRef.current = null
      }

      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
        rsiSeriesRef.current = null
      }
    }
  }, [data, rsiLineData])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-white/10 bg-black p-4 text-sm text-slate-400">
          Loading QCAP chart...
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              RSI
            </div>
            <div className="text-2xl font-semibold text-slate-300">—</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Calculating momentum...
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              Stoch RSI
            </div>
            <div className="text-2xl font-semibold text-slate-300">—</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Tracked indicator placeholder.
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              MACD
            </div>
            <div className="text-2xl font-semibold text-slate-300">—</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Tracked indicator placeholder.
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              Signal Bias
            </div>
            <div className="text-2xl font-semibold text-slate-300">Neutral</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Waiting for indicator context.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data.length) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-white/10 bg-black p-4 text-sm text-red-400">
          Failed to load QCAP data
          {error ? (
            <div className="mt-2 text-xs text-slate-400">{error}</div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              RSI
            </div>
            <div className="text-2xl font-semibold text-slate-300">—</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Unable to calculate.
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              Stoch RSI
            </div>
            <div className="text-2xl font-semibold text-slate-300">—</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Tracked indicator placeholder.
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              MACD
            </div>
            <div className="text-2xl font-semibold text-slate-300">—</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Tracked indicator placeholder.
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
              Signal Bias
            </div>
            <div className="text-2xl font-semibold text-slate-300">Neutral</div>
            <div className="mt-3 text-sm text-muted-foreground">
              Waiting for indicator context.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span>Candles: {data.length}</span>
          {latestCandle ? (
            <span>Last Close: {formatQcapPrice(latestCandle.close)}</span>
          ) : null}
        </div>

        <div>
          {hasEnoughHistoryForIndicators ? (
            <span className="text-emerald-500">
              Indicator history threshold passed
            </span>
          ) : (
            <span className="text-amber-500">
              Limited history — chart is valid, but custom indicators should stay disabled until at least {MIN_CANDLES_FOR_INDICATORS} candles are available
            </span>
          )}
        </div>
      </div>

      {tooltipCandle ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-white/10 bg-black px-3 py-2 text-xs text-slate-300">
          <span className="text-slate-400">
            {formatDateFromUnix(tooltipCandle.time)}
          </span>
          <span>O: {formatQcapPrice(tooltipCandle.open)}</span>
          <span>H: {formatQcapPrice(tooltipCandle.high)}</span>
          <span>L: {formatQcapPrice(tooltipCandle.low)}</span>
          <span>C: {formatQcapPrice(tooltipCandle.close)}</span>
          <span>V: {formatVolume(tooltipCandle.volume)}</span>
          {tooltipRsi !== null ? (
            <span>RSI: {tooltipRsi.toFixed(2)}</span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded border border-white/10 bg-black shadow-inner">
        <div ref={priceContainerRef} className="h-[340px] w-full" />
        <div className="border-t border-white/10" />
        <div ref={rsiContainerRef} className="h-[120px] w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-background p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
            RSI
          </div>
          <div className={`text-2xl font-semibold ${rsiState.valueClassName}`}>
            {latestRsi !== null ? latestRsi.toFixed(2) : "—"}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-200">
            {rsiState.label}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {rsiState.note}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
            Stoch RSI
          </div>
          <div className="text-2xl font-semibold text-slate-300">—</div>
          <div className="mt-3 text-sm text-muted-foreground">
            Tracked indicator placeholder.
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
            MACD
          </div>
          <div className="text-2xl font-semibold text-slate-300">—</div>
          <div className="mt-3 text-sm text-muted-foreground">
            Tracked indicator placeholder.
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">
            Signal Bias
          </div>
          <div className={`text-2xl font-semibold ${signalBias.valueClassName}`}>
            {signalBias.label}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {signalBias.note}
          </div>
        </div>
      </div>
    </div>
  )
}