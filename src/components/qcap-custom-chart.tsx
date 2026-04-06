"use client"

import { useEffect, useState } from "react"

type ChartCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type RawQcapCandle = {
  openTime: number
  open: string | number
  high: string | number
  low: string | number
  close: string | number
  volume: string | number
}

export default function QcapCustomChart() {
  const [data, setData] = useState<ChartCandle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          "https://qubicswap.com/api/v1/markets/QCAP/candles?interval=1d&days=180&limit=200"
        )

        if (!res.ok) {
          setData([])
          return
        }

        const json = await res.json()

        const candles: RawQcapCandle[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : []

        const formatted: ChartCandle[] = candles.map((c) => ({
          time: Math.floor(Number(c.openTime) / 1000),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
        }))

        setData(formatted)
      } catch {
        setData([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
        Loading QCAP chart...
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-red-400">
        Failed to load QCAP data
      </div>
    )
  }

  return (
    <div className="h-[400px] overflow-auto rounded bg-black/20 p-3 text-xs">
      <pre>{JSON.stringify(data.slice(0, 20), null, 2)}</pre>
    </div>
  )
}