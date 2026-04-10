import { NextRequest, NextResponse } from "next/server"
import { getAssetRegistryEntry } from "@/lib/market/asset-registry"
import {
  fetchGeckoPoolCandles,
  resolveBasePoolFromTokenAddress,
} from "@/lib/market/gecko-terminal"
import { computeIndicators } from "@/lib/indicator-engine"
import type { PortaTimeframe } from "@/lib/market/types"

const ALLOWED_TIMEFRAMES: PortaTimeframe[] = ["1h", "4h", "1d", "1w"]

function normalizeAssetKey(value: string | null): string {
  return String(value ?? "").trim()
}

function normalizeTimeframe(value: string | null): PortaTimeframe {
  const candidate = String(value ?? "4h").trim().toLowerCase() as PortaTimeframe
  return ALLOWED_TIMEFRAMES.includes(candidate) ? candidate : "4h"
}

function deriveSignalBias(params: {
  rsi: number | null
  stochK: number | null
  stochD: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
}): {
  label: "Bullish" | "Neutral" | "Bearish" | "Unavailable"
  summary: string
} {
  const { rsi, stochK, stochD, macd, macdSignal, macdHistogram } = params

  if (
    rsi === null ||
    stochK === null ||
    stochD === null ||
    macd === null ||
    macdSignal === null ||
    macdHistogram === null
  ) {
    return {
      label: "Unavailable",
      summary: "Not enough history to derive a signal bias yet.",
    }
  }

  let score = 0

  if (rsi >= 55) score += 1
  if (rsi <= 45) score -= 1

  if (stochK > stochD) score += 1
  if (stochK < stochD) score -= 1

  if (macd > macdSignal) score += 1
  if (macd < macdSignal) score -= 1

  if (macdHistogram > 0) score += 1
  if (macdHistogram < 0) score -= 1

  if (score >= 2) {
    return {
      label: "Bullish",
      summary: "Momentum and trend signals are leaning bullish.",
    }
  }

  if (score <= -2) {
    return {
      label: "Bearish",
      summary: "Momentum and trend signals are leaning bearish.",
    }
  }

  return {
    label: "Neutral",
    summary: "Signals are mixed and do not show a strong directional edge.",
  }
}

export async function GET(request: NextRequest) {
  try {
    const asset = normalizeAssetKey(request.nextUrl.searchParams.get("asset"))
    const timeframe = normalizeTimeframe(
      request.nextUrl.searchParams.get("timeframe")
    )

    if (!asset) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing asset query param",
        },
        { status: 400 }
      )
    }

    const entry = getAssetRegistryEntry(asset)

    if (!entry) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported asset: ${asset}`,
        },
        { status: 404 }
      )
    }

    if (entry.source === "qubicswap") {
      return NextResponse.json(
        {
          ok: false,
          error: `Indicator source not wired yet for ${asset}`,
          source: entry.source,
        },
        { status: 501 }
      )
    }

    if (entry.source !== "gecko_pool" || !entry.tokenAddress) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid asset configuration for ${asset}`,
        },
        { status: 500 }
      )
    }

    const resolvedPool = await resolveBasePoolFromTokenAddress({
      tokenAddress: entry.tokenAddress,
      preferredDex: entry.preferredDex,
    })

    const candles = await fetchGeckoPoolCandles({
      poolAddress: resolvedPool.poolAddress,
      timeframe,
      currency: "usd",
      tokenSide: "base",
    })

    const indicators = computeIndicators(candles)

    const signalBias = deriveSignalBias({
      rsi: indicators.rsi,
      stochK: indicators.stoch_k,
      stochD: indicators.stoch_d,
      macd: indicators.macd,
      macdSignal: indicators.macd_signal,
      macdHistogram: indicators.macd_histogram,
    })

    return NextResponse.json({
      ok: true,
      asset,
      timeframe,
      source: entry.source,
      resolvedPool,
      candleCount: candles.length,
      lastCandle: candles[candles.length - 1] ?? null,
      indicators,
      signalBias,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}