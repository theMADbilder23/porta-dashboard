"use client"

import { useEffect, useState } from "react"
import { fetchQubicCandles, type ChartCandle } from "@/lib/qubic/qcap-chart"

export default function QcapCustomChart() {
  const [data, setData] = useState<ChartCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const candles = await fetchQubicCandles()

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

  if (loading) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
        Loading QCAP chart...
      </div>
    )
  }

  if (error || !data.length) {
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