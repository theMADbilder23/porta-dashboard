import { NextResponse } from "next/server"
import { getAssetRegistryEntry } from "@/lib/market/asset-registry"
import {
  fetchGeckoPoolCandles,
  resolveBasePoolFromTokenAddress,
} from "@/lib/market/gecko-terminal"

export async function GET() {
  try {
    const entry = getAssetRegistryEntry("base:WELL")

    if (!entry?.tokenAddress) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing registry entry or token address for base:WELL",
        },
        { status: 400 }
      )
    }

    const resolvedPool = await resolveBasePoolFromTokenAddress({
      tokenAddress: entry.tokenAddress,
      preferredDex: entry.preferredDex,
    })

    const candles = await fetchGeckoPoolCandles({
      poolAddress: resolvedPool.poolAddress,
      timeframe: "4h",
      currency: "usd",
      tokenSide: "base",
    })

    return NextResponse.json({
      ok: true,
      asset: entry.assetKey,
      tokenAddress: entry.tokenAddress,
      resolvedPool,
      candleCount: candles.length,
      firstCandle: candles[0] ?? null,
      lastCandle: candles[candles.length - 1] ?? null,
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