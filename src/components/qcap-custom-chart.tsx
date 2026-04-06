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

export default function QcapCustomChart() {
  const [data, setData] = useState<ChartCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(124, 58, 237, 0.30)" },
        horzLine: { color: "rgba(124, 58, 237, 0.30)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: {
          top: 0.08,
          bottom: 0.30,
        },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
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
    })

    candleSeries.setData(toCandlestickData(data))
    volumeSeries.setData(toVolumeData(data))
    chart.timeScale().fitContent()

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
      <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
        Loading QCAP chart...
      </div>
    )
  }

  if (error || !data.length) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center gap-2 px-4 text-center">
        <div className="text-sm text-red-400">Failed to load QCAP data</div>
        {error ? (
          <div className="max-w-xl text-xs text-muted-foreground">{error}</div>
        ) : null}
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

      <div className="h-[400px] w-full overflow-hidden rounded bg-black/10">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}