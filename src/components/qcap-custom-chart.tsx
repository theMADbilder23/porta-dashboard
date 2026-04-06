"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
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

const MIN_CANDLES_FOR_INDICATORS = 120

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

export default function QcapCustomChart() {
  const [data, setData] = useState<ChartCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredCandle, setHoveredCandle] = useState<ChartCandle | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)

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

  const latestRsi = useMemo(() => {
    if (!hasEnoughHistoryForIndicators || !data.length) return null

    const closes = data.map((candle) => candle.close)
    const rsiSeries = calculateRSI(closes, 14)

    if (!rsiSeries.length) return null

    return rsiSeries[rsiSeries.length - 1]
  }, [data, hasEnoughHistoryForIndicators])

  const rsiState = useMemo(() => getRsiState(latestRsi), [latestRsi])

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }

    const container = containerRef.current

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: "#050816" },
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
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        scaleMargins: {
          top: 0.08,
          bottom: 0.30,
        },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price: number) => formatQcapPrice(price),
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
      borderColor: "rgba(148, 163, 184, 0.12)",
    })

    candleSeries.setData(toCandlestickData(data))
    volumeSeries.setData(toVolumeData(data))
    chart.timeScale().fitContent()

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoveredCandle(null)
        return
      }

      const hoveredTime = Number(param.time)
      const match = data.find((candle) => candle.time === hoveredTime) ?? null
      setHoveredCandle(match)
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return

      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: 400,
      })
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()

      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        candleSeriesRef.current = null
        volumeSeriesRef.current = null
      }
    }
  }, [data])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
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
              Porta interpretation placeholder.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data.length) {
    return (
      <div className="space-y-3">
        <div className="h-[400px] flex flex-col items-center justify-center gap-2 px-4 text-center">
          <div className="text-sm text-red-400">Failed to load QCAP data</div>
          {error ? (
            <div className="max-w-xl text-xs text-muted-foreground">{error}</div>
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
              Porta interpretation placeholder.
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
        </div>
      ) : null}

      <div className="h-[400px] w-full overflow-hidden rounded border border-white/10 bg-black shadow-inner">
        <div ref={containerRef} className="h-full w-full" />
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
          <div className="text-2xl font-semibold text-slate-300">Neutral</div>
          <div className="mt-3 text-sm text-muted-foreground">
            Porta interpretation placeholder.
          </div>
        </div>
      </div>
    </div>
  )
}