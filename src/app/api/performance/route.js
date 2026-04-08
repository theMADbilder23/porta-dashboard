import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  capitalizeTimeframe,
  getTimeframeStart,
  getBucketKey,
  buildBucketTotals,
  buildDailySummary,
  makeTrendBucketLabel,
} from "../../../../collector/lib/porta-math/dyf.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = String(searchParams.get("timeframe") || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id")
      .eq("is_active", true);

    if (walletsError) {
      throw walletsError;
    }

    const walletIds = Array.isArray(wallets)
      ? wallets.map((wallet) => wallet.id)
      : [];

    if (walletIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(
        "wallet_id, snapshot_time, total_value_usd, total_claimable_usd, total_pending_usd"
      )
      .in("wallet_id", walletIds)
      .gte(
        "snapshot_time",
        new Date(
          new Date(timeframeStart).getTime() - 48 * 60 * 60 * 1000
        ).toISOString()
      )
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) {
      throw snapshotsError;
    }

    const allSnapshots = Array.isArray(snapshots) ? snapshots : [];

    if (allSnapshots.length === 0) {
      return NextResponse.json([]);
    }

    if (timeframe === "daily") {
      return NextResponse.json([buildDailySummary(allSnapshots, timeframeStart)]);
    }

    const bucketSeries = buildBucketTotals(allSnapshots, timeframe);

    const result = bucketSeries.map((row) => ({
      mode: "trend",
      snapshot_time: row.snapshot_time,
      label:
        makeTrendBucketLabel(
          row.bucketKey ?? row.bucket_key ?? getBucketKey(row.snapshot_time, timeframe),
          timeframe
        ) || timeframe,
      metric_label: `${capitalizeTimeframe(timeframe)} Yield Flow`,
      total_value_usd: row.total_value_usd,
      total_claimable_usd: row.total_claimable_usd,
      total_pending_usd: row.total_pending_usd,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/performance] error:", err);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}