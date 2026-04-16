"use client"

import { useEffect, useMemo, useState } from "react"
import type {
  ChartSource,
  ChartTimeframe,
  ResolvedChartConfig,
} from "@/lib/chart-resolver"

type AssetChartEmbedProps = {
  chartConfig: ResolvedChartConfig
  defaultTimeframe?: ChartTimeframe
}

function timeframeToTradingViewInterval(timeframe: ChartTimeframe) {
  switch (timeframe) {
    case "1H":
      return "60"
    case "4H":
      return "240"
    case "1D":
      return "D"
    case "1W":
      return "W"
    default:
      return "240"
  }
}

export default function AssetChartEmbed({
  chartConfig,
  defaultTimeframe = "4H",
}: AssetChartEmbedProps) {
  const [selectedSource, setSelectedSource] = useState<ChartSource>(
    chartConfig.preferredSource
  )

  useEffect(() => {
    setSelectedSource(chartConfig.preferredSource)
  }, [chartConfig.preferredSource])

  const tradingViewUrl = useMemo(() => {
    if (!chartConfig.tradingviewSymbol) return null

    const interval = timeframeToTradingViewInterval(defaultTimeframe)
    const symbol = encodeURIComponent(chartConfig.tradingviewSymbol)

    return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_asset_chart&symbol=${symbol}&interval=${interval}&hidesidetoolbar=1&hidetoptoolbar=0&symboledit=0&saveimage=0&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hidevolume=0&allow_symbol_change=0`
  }, [chartConfig.tradingviewSymbol, defaultTimeframe])

  const dexscreenerUrl = chartConfig.dexscreenerUrl ?? null

  const availableSources = chartConfig.availableSources.filter(
    (source) => source !== "none"
  )

  const selectedSourceIsAvailable =
    selectedSource !== "none" && availableSources.includes(selectedSource)

  const effectiveSource = selectedSourceIsAvailable
    ? selectedSource
    : chartConfig.preferredSource

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 laptop:flex-row laptop:items-center laptop:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Chart Source
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!availableSources.includes("tradingview")}
              onClick={() => setSelectedSource("tradingview")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                effectiveSource === "tradingview"
                  ? "bg-[#7C3AED] text-white shadow-sm"
                  : "border border-[#E9DAFF] bg-white text-[#6D28D9] hover:bg-[#F3E8FF] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
              }`}
            >
              TradingView
            </button>

            <button
              type="button"
              disabled={!availableSources.includes("dexscreener")}
              onClick={() => setSelectedSource("dexscreener")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                effectiveSource === "dexscreener"
                  ? "bg-[#7C3AED] text-white shadow-sm"
                  : "border border-[#E9DAFF] bg-white text-[#6D28D9] hover:bg-[#F3E8FF] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#312047] dark:bg-[#100A19] dark:text-[#D8B4FE] dark:hover:bg-[#1A1226]"
              }`}
            >
              Dexscreener
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-[420px] overflow-hidden rounded-2xl border border-dashed border-[#D9C5FF] bg-[#FCFAFF] p-0 dark:border-[#3A2952] dark:bg-[#140D20]">
        {effectiveSource === "dexscreener" && dexscreenerUrl ? (
          <iframe
            title="Dexscreener Chart"
            src={dexscreenerUrl}
            className="h-[560px] laptop:h-[620px] desktop:h-[680px] w-full border-0"
            allowFullScreen
          />
        ) : null}

        {effectiveSource === "tradingview" && tradingViewUrl ? (
          <iframe
            title="TradingView Chart"
            src={tradingViewUrl}
            className="h-[560px] laptop:h-[620px] desktop:h-[680px] w-full border-0"
            allowFullScreen
          />
        ) : null}

        {((effectiveSource === "dexscreener" && !dexscreenerUrl) ||
          (effectiveSource === "tradingview" && !tradingViewUrl) ||
          chartConfig.preferredSource === "none") && (
          <div className="flex h-[560px] laptop:h-[620px] desktop:h-[680px] flex-col justify-center p-6">
            <p className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
              Chart unavailable for this asset
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
              This asset does not yet have a resolved TradingView or Dexscreener
              chart configuration.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}