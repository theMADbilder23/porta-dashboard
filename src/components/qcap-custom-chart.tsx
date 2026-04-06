"use client"

import { useEffect, useState } from "react"
import { type ChartCandle } from "@/lib/qubic/qcap-chart"

type ErrorPayload = {
  error?: string
  message?: string
  status?: number
  contentType?: string
  preview?: string
  rawCount?: number
}

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
    <div className="h-[400px] overflow-auto rounded bg-black/20 p-3 text-xs">
      <pre>{JSON.stringify(data.slice(0, 20), null, 2)}</pre>
    </div>
  )
}