import { createClient } from "@supabase/supabase-js";
import {
  buildDailySummary,
  getTimeframeStart,
} from "./lib/porta-math/dyf.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLAIMABLE_DROP_MIN_USD = 5;
const CLAIM_CONFIDENCE_MIN_RATIO = 0.5;
const ANOMALY_RECOVERY_RATIO = 0.85;
const ANOMALY_LOOKAHEAD_BUCKETS = 6;
const RESET_PENDING_LOW_USD = 2;
const RESET_PENDING_HIGH_USD = 2.5;

function normalizeTimeframe(value) {
  const timeframe = String(value || "daily").toLowerCase();

  if (
    timeframe === "daily" ||
    timeframe === "weekly" ||
    timeframe === "monthly" ||
    timeframe === "quarterly" ||
    timeframe === "yearly"
  ) {
    return timeframe;
  }

  return "daily";
}

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatTrendLabel(metricDate, metricTime, timeframe) {
  if (timeframe === "weekly" && metricTime) {
    const date = new Date(metricTime);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
      });
    }
  }

  if (!metricDate) return "";

  const date = new Date(`${metricDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return metricDate;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function getStoredTimeframeSnapshot(timeframe) {
  const { data, error } = await supabase
    .from("timeframe_metric_snapshots")
    .select("*")
    .eq("timeframe", timeframe)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

function buildWalletSnapshotTotalsByTime(rows) {
  const latestPerWalletPerTimestamp = new Map();

  for (const row of rows || []) {
    const timestamp = row.snapshot_time;
    const walletId = row.wallet_id;
    const key = `${timestamp}__${walletId}`;
    const existing = latestPerWalletPerTimestamp.get(key);

    if (
      !existing ||
      new Date(row.created_at || row.snapshot_time).getTime() >
        new Date(existing.created_at || existing.snapshot_time).getTime()
    ) {
      latestPerWalletPerTimestamp.set(key, row);
    }
  }

  const totalsByTime = new Map();

  for (const row of latestPerWalletPerTimestamp.values()) {
    const timestamp = row.snapshot_time;

    if (!totalsByTime.has(timestamp)) {
      totalsByTime.set(timestamp, {
        snapshot_time: timestamp,
        total_claimable_usd: 0,
        total_claimed_usd: 0,
        total_pending_usd: 0,
      });
    }

    const bucket = totalsByTime.get(timestamp);
    bucket.total_claimable_usd += safeNumber(row.total_claimable_usd);
    bucket.total_claimed_usd += safeNumber(row.total_claimed_usd);
    bucket.total_pending_usd += safeNumber(row.total_pending_usd);
  }

  return new Map(
    Array.from(totalsByTime.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    )
  );
}

function detectWeeklyClaimableAnomalies(rows, walletTotalsByTime) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const enriched = rows.map((row) => {
    const walletTotals = walletTotalsByTime.get(row.metric_time) || {
      total_claimable_usd: safeNumber(row.total_claimable_usd),
      total_claimed_usd: 0,
      total_pending_usd: safeNumber(row.total_pending_usd),
    };

    return {
      ...row,
      raw_claimable_usd: safeNumber(row.total_claimable_usd),
      total_claimed_usd: safeNumber(walletTotals.total_claimed_usd),
      total_pending_usd: safeNumber(walletTotals.total_pending_usd),
      filtered_claimable_usd: safeNumber(row.total_claimable_usd),
      claim_event_detected: false,
      anomaly_drop_detected: false,
    };
  });

  for (let i = 1; i < enriched.length; i += 1) {
    const prev = enriched[i - 1];
    const current = enriched[i];

    const claimableDrop =
      safeNumber(prev.filtered_claimable_usd) -
      safeNumber(current.raw_claimable_usd);

    if (claimableDrop < CLAIMABLE_DROP_MIN_USD) {
      current.filtered_claimable_usd = current.raw_claimable_usd;
      continue;
    }

    const claimedIncrease =
      safeNumber(current.total_claimed_usd) - safeNumber(prev.total_claimed_usd);

    const claimedCoverageRatio =
      claimableDrop > 0 ? claimedIncrease / claimableDrop : 0;

    const pendingResetDetected =
      safeNumber(prev.total_pending_usd) >= RESET_PENDING_HIGH_USD &&
      safeNumber(current.total_pending_usd) <= RESET_PENDING_LOW_USD;

    let recoveredQuickly = false;
    const targetRecoveryLevel =
      safeNumber(prev.filtered_claimable_usd) * ANOMALY_RECOVERY_RATIO;

    for (
      let lookahead = i + 1;
      lookahead < Math.min(enriched.length, i + 1 + ANOMALY_LOOKAHEAD_BUCKETS);
      lookahead += 1
    ) {
      if (safeNumber(enriched[lookahead].raw_claimable_usd) >= targetRecoveryLevel) {
        recoveredQuickly = true;
        break;
      }
    }

    const confirmedClaimEvent =
      claimedIncrease >= CLAIMABLE_DROP_MIN_USD &&
      claimedCoverageRatio >= CLAIM_CONFIDENCE_MIN_RATIO &&
      !recoveredQuickly;

    const likelyResetEvent =
      pendingResetDetected &&
      claimedIncrease > 0 &&
      !recoveredQuickly;

    const anomalyDrop =
      !confirmedClaimEvent &&
      !likelyResetEvent &&
      claimedIncrease < CLAIMABLE_DROP_MIN_USD &&
      recoveredQuickly;

    if (confirmedClaimEvent || likelyResetEvent) {
      current.claim_event_detected = true;
      current.filtered_claimable_usd = current.raw_claimable_usd;
      continue;
    }

    if (anomalyDrop) {
      current.anomaly_drop_detected = true;
      current.filtered_claimable_usd = prev.filtered_claimable_usd;
      continue;
    }

    current.filtered_claimable_usd = current.raw_claimable_usd;
  }

  return enriched;
}

export default async function handler(req, res) {
  try {
    const timeframe = normalizeTimeframe(req.query?.timeframe);
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const walletIds = Array.isArray(wallets)
      ? wallets.map((wallet) => wallet.id)
      : [];

    if (walletIds.length === 0) {
      return res.status(200).json([]);
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

    if (snapshotsError) throw snapshotsError;

    const allSnapshots = Array.isArray(snapshots) ? snapshots : [];

    if (allSnapshots.length === 0) {
      return res.status(200).json([]);
    }

    if (timeframe === "daily") {
      return res
        .status(200)
        .json([buildDailySummary(allSnapshots, timeframeStart)]);
    }

    const storedTimeframe = await getStoredTimeframeSnapshot(timeframe);

    if (!storedTimeframe || !storedTimeframe.sufficient_data) {
      return res.status(200).json([]);
    }

    const windowStartDate =
      storedTimeframe.window_start_date || timeframeStart.slice(0, 10);

    const windowEndDate =
      storedTimeframe.as_of_date ||
      storedTimeframe.window_end_date ||
      new Date().toISOString().slice(0, 10);

    if (timeframe === "weekly") {
      const intradayWindowStartIso = `${windowStartDate}T00:00:00Z`;
      const intradayWindowEndIso = `${windowEndDate}T23:59:59.999Z`;

      const { data: intradayRows, error: intradayRowsError } = await supabase
        .from("intraday_metric_snapshots")
        .select("*")
        .gte("metric_time", intradayWindowStartIso)
        .lte("metric_time", intradayWindowEndIso)
        .order("metric_time", { ascending: true });

      if (intradayRowsError) throw intradayRowsError;

      const { data: walletWindowRows, error: walletWindowRowsError } = await supabase
        .from("wallet_snapshots")
        .select(
          "wallet_id, snapshot_time, total_claimable_usd, total_claimed_usd, total_pending_usd, created_at"
        )
        .in("wallet_id", walletIds)
        .gte("snapshot_time", intradayWindowStartIso)
        .lte("snapshot_time", intradayWindowEndIso)
        .order("snapshot_time", { ascending: true });

      if (walletWindowRowsError) throw walletWindowRowsError;

      const rows = Array.isArray(intradayRows) ? intradayRows : [];

      if (rows.length === 0) {
        return res.status(200).json([]);
      }

      const walletTotalsByTime = buildWalletSnapshotTotalsByTime(
        Array.isArray(walletWindowRows) ? walletWindowRows : []
      );

      const cleanedRows = detectWeeklyClaimableAnomalies(rows, walletTotalsByTime);

      const trend = cleanedRows.map((row) => ({
        mode: "trend",
        snapshot_time: row.metric_time || `${row.metric_date}T00:00:00Z`,
        label: formatTrendLabel(row.metric_date, row.metric_time, timeframe),
        metric_label: "Weekly Yield Flow",
        total_value_usd: Number(row.total_portfolio_value || 0),
        total_claimable_usd: Number(row.filtered_claimable_usd || 0),
        raw_total_claimable_usd: Number(row.raw_claimable_usd || 0),
        total_claimed_usd: Number(row.total_claimed_usd || 0),
        total_pending_usd: Number(row.total_pending_usd || 0),
        total_yield_flow_usd: Number(row.total_daily_yield_flow || 0),
        yield_tvd_ratio: Number(row.yield_tvd_ratio || 0),
        claim_event_detected: Boolean(row.claim_event_detected),
        anomaly_drop_detected: Boolean(row.anomaly_drop_detected),
        metric_date: row.metric_date || null,
        metric_time: row.metric_time || null,
      }));

      return res.status(200).json(trend);
    }

    const { data: dailyRows, error: dailyRowsError } = await supabase
      .from("daily_metric_snapshots")
      .select("*")
      .gte("metric_date", windowStartDate)
      .lte("metric_date", windowEndDate)
      .order("metric_date", { ascending: true });

    if (dailyRowsError) throw dailyRowsError;

    const rows = Array.isArray(dailyRows) ? dailyRows : [];

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const trend = rows.map((row) => ({
      mode: "trend",
      snapshot_time: row.metric_time || `${row.metric_date}T00:00:00Z`,
      label: formatTrendLabel(row.metric_date, row.metric_time, timeframe),
      metric_label: `${timeframe[0].toUpperCase()}${timeframe.slice(1)} Yield Flow`,
      total_value_usd: Number(row.total_portfolio_value || 0),
      total_claimable_usd: Number(row.total_claimable_usd || 0),
      total_pending_usd: Number(row.total_pending_usd || 0),
      total_yield_flow_usd: Number(row.total_daily_yield_flow || 0),
      yield_tvd_ratio: Number(row.yield_tvd_ratio || 0),
      metric_date: row.metric_date || null,
      metric_time: row.metric_time || null,
    }));

    return res.status(200).json(trend);
  } catch (err) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: err?.message || "Unknown error",
    });
  }
}