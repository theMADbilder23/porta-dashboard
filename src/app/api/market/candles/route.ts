import { NextRequest, NextResponse } from "next/server"
import { getAssetRegistryEntry } from "@/lib/market/asset-registry"
import {
  fetchGeckoPoolCandles,
  resolveBasePoolFromTokenAddress,
} from "@/lib/market/gecko-terminal"
import type { PortaTimeframe } from "@/lib/market/types"

const ALLOWED_TIMEFRAMES: PortaTimeframe[] = ["1h", "4h", "1d", "1w"]

function normalizeAssetKey(value: string | null): string {
  return String(value ?? "").trim()
}

function normalizeTimeframe(value: string | null): PortaTimeframe {
  const candidate = String(value ?? "4h").trim().toLowerCase() as PortaTimeframe
  return ALLOWED_TIMEFRAMES.includes(candidate) ? candidate : "4h"
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
          error: `Asset source not wired yet for ${asset}`,
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

    return NextResponse.json({
      ok: true,
      asset,
      timeframe,
      source: entry.source,
      resolvedPool,
      candleCount: candles.length,
      candles,
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