function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function capitalizeTimeframe(timeframe) {
  const value = String(timeframe || "daily").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTimeframeStart(timeframe) {
  const now = new Date();

  switch ((timeframe || "daily").toLowerCase()) {
    case "weekly": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "monthly": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    case "quarterly": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    case "yearly": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    case "daily":
    default: {
      return new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
    }
  }
}

function getBucketKey(dateString, timeframe) {
  const d = new Date(dateString);

  if (timeframe === "daily") {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hour = String(d.getUTCHours()).padStart(2, "0");
    const minuteBucket = d.getUTCMinutes() < 30 ? "00" : "30";
    return `${year}-${month}-${day}T${hour}:${minuteBucket}:00Z`;
  }

  if (timeframe === "weekly" || timeframe === "monthly") {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (timeframe === "quarterly") {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  const year = d.getUTCFullYear();
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function getPortfolioSnapshotValue(snapshot) {
  return (
    safeNumber(snapshot.total_value_usd) +
    safeNumber(snapshot.total_claimable_usd)
  );
}

function getClaimableSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_claimable_usd);
}

function getPendingSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_pending_usd);
}

function buildLatestPerWallet(snapshots) {
  const latestPerWallet = new Map();

  for (const snapshot of snapshots || []) {
    const existing = latestPerWallet.get(snapshot.wallet_id);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWallet.set(snapshot.wallet_id, snapshot);
    }
  }

  return latestPerWallet;
}

function buildLatestCurrentTotals(snapshots) {
  const latestPerWallet = buildLatestPerWallet(snapshots);

  let totalPortfolioValue = 0;
  let totalClaimableValue = 0;
  let latestSnapshotTime = null;

  for (const snapshot of latestPerWallet.values()) {
    totalPortfolioValue += getPortfolioSnapshotValue(snapshot);
    totalClaimableValue += getClaimableSnapshotValue(snapshot);

    if (
      !latestSnapshotTime ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(latestSnapshotTime).getTime()
    ) {
      latestSnapshotTime = snapshot.snapshot_time;
    }
  }

  return {
    snapshot_time: latestSnapshotTime,
    total_value_usd: totalPortfolioValue,
    total_claimable_usd: totalClaimableValue,
  };
}

function buildBucketTotals(snapshots, timeframe) {
  const latestPerWalletPerBucket = new Map();

  for (const snapshot of snapshots || []) {
    const bucketKey = getBucketKey(snapshot.snapshot_time, timeframe);
    const compositeKey = `${bucketKey}__${snapshot.wallet_id}`;
    const existing = latestPerWalletPerBucket.get(compositeKey);

    if (
      !existing ||
      new Date(snapshot.snapshot_time).getTime() >
        new Date(existing.snapshot_time).getTime()
    ) {
      latestPerWalletPerBucket.set(compositeKey, snapshot);
    }
  }

  const bucketTotals = new Map();

  for (const [compositeKey, snapshot] of latestPerWalletPerBucket.entries()) {
    const bucketKey = compositeKey.split("__")[0];

    if (!bucketTotals.has(bucketKey)) {
      bucketTotals.set(bucketKey, {
        bucket_key: bucketKey,
        bucketKey,
        snapshot_time: snapshot.snapshot_time,
        portfolio_total_usd: 0,
        claimable_total_usd: 0,
        pending_total_usd: 0,
        total_value_usd: 0,
        total_claimable_usd: 0,
        total_pending_usd: 0,
      });
    }

    const bucket = bucketTotals.get(bucketKey);

    const portfolioValue = getPortfolioSnapshotValue(snapshot);
    const claimableValue = getClaimableSnapshotValue(snapshot);
    const pendingValue = getPendingSnapshotValue(snapshot);

    bucket.portfolio_total_usd += portfolioValue;
    bucket.claimable_total_usd += claimableValue;
    bucket.pending_total_usd += pendingValue;

    bucket.total_value_usd += portfolioValue;
    bucket.total_claimable_usd += claimableValue;
    bucket.total_pending_usd += pendingValue;

    if (
      new Date(snapshot.snapshot_time).getTime() >
      new Date(bucket.snapshot_time).getTime()
    ) {
      bucket.snapshot_time = snapshot.snapshot_time;
    }
  }

  return Array.from(bucketTotals.values()).sort(
    (a, b) => new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime()
  );
}

function splitDailyBucketTotalsForWindow(bucketTotals, timeframeStartIso) {
  const startMs = new Date(timeframeStartIso).getTime();

  if (!Array.isArray(bucketTotals) || bucketTotals.length === 0) {
    return {
      contextBuckets: [],
      displayBuckets: [],
      displayStartIndex: -1,
    };
  }

  const displayStartIndex = bucketTotals.findIndex(
    (bucket) => new Date(bucket.snapshot_time).getTime() >= startMs
  );

  if (displayStartIndex === -1) {
    return {
      contextBuckets: bucketTotals.slice(-1),
      displayBuckets: bucketTotals.slice(-1),
      displayStartIndex: bucketTotals.length - 1,
    };
  }

  const contextStartIndex = Math.max(0, displayStartIndex - 1);

  return {
    contextBuckets: bucketTotals.slice(contextStartIndex),
    displayBuckets: bucketTotals.slice(displayStartIndex),
    displayStartIndex,
  };
}

function splitDailyBucketSeriesForWindow(bucketSeries, timeframeStartIso) {
  return splitDailyBucketTotalsForWindow(bucketSeries, timeframeStartIso);
}

function getAverageValue(values, { ignoreZero = false } = {}) {
  const filtered = (values || [])
    .map((v) => safeNumber(v))
    .filter((v) => (ignoreZero ? v > 0 : true));

  if (filtered.length === 0) return 0;
  return filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
}

function getAverage(values) {
  return getAverageValue(values);
}

function getMinValue(values, { ignoreZero = false } = {}) {
  const filtered = (values || [])
    .map((v) => safeNumber(v))
    .filter((v) => (ignoreZero ? v > 0 : true));

  if (filtered.length === 0) return 0;
  return Math.min(...filtered);
}

function getMin(values, options = {}) {
  return getMinValue(values, options);
}

function getMaxValue(values) {
  const filtered = (values || []).map((v) => safeNumber(v));
  if (filtered.length === 0) return 0;
  return Math.max(...filtered);
}

function getMax(values) {
  return getMaxValue(values);
}

function getPctChange(fromValue, toValue) {
  const from = safeNumber(fromValue);
  const to = safeNumber(toValue);

  if (from <= 0) return 0;
  return ((to - from) / from) * 100;
}

function getChangePctFromMin(current, min) {
  const currentValue = safeNumber(current);
  const minValue = safeNumber(min);

  if (minValue <= 0) return null;
  return (currentValue - minValue) / minValue;
}

function getRangeFlow(maxValue, minValue) {
  const max = safeNumber(maxValue);
  const min = safeNumber(minValue);
  return Math.max(0, max - min);
}

function getUtcDayStartIso(value) {
  const date = new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();

  return new Date(
    Date.UTC(
      safeDate.getUTCFullYear(),
      safeDate.getUTCMonth(),
      safeDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  ).toISOString();
}

function formatDailyLabel(snapshotTime) {
  const d = new Date(snapshotTime);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function makeTrendBucketLabel(bucketKey, timeframe) {
  if (timeframe === "weekly") {
    const d = new Date(`${bucketKey}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  if (timeframe === "monthly") {
    const d = new Date(`${bucketKey}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (timeframe === "quarterly") {
    const [year, month] = bucketKey.split("-");
    const d = new Date(`${year}-${month}-01T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short" });
  }

  return bucketKey;
}

function buildRawDailySnapshotSeries(snapshots) {
  const ordered = [...(snapshots || [])].sort(
    (a, b) => new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime()
  );

  const latestPerWalletAtMoment = new Map();
  const series = [];

  for (const snapshot of ordered) {
    latestPerWalletAtMoment.set(snapshot.wallet_id, snapshot);

    let totalValueUsd = 0;
    let totalClaimableUsd = 0;
    let totalPendingUsd = 0;

    for (const currentSnapshot of latestPerWalletAtMoment.values()) {
      totalValueUsd += getPortfolioSnapshotValue(currentSnapshot);
      totalClaimableUsd += getClaimableSnapshotValue(currentSnapshot);
      totalPendingUsd += getPendingSnapshotValue(currentSnapshot);
    }

    series.push({
      snapshot_time: snapshot.snapshot_time,
      total_value_usd: totalValueUsd,
      total_claimable_usd: totalClaimableUsd,
      total_pending_usd: totalPendingUsd,
      wallet_id: snapshot.wallet_id,
    });
  }

  return series;
}

function splitRawDailySnapshotsForWindow(rawSeries, timeframeStartIso) {
  const startMs = new Date(timeframeStartIso).getTime();

  if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
    return {
      contextSnapshots: [],
      displaySnapshots: [],
      displayStartIndex: -1,
    };
  }

  const displayStartIndex = rawSeries.findIndex(
    (row) => new Date(row.snapshot_time).getTime() >= startMs
  );

  if (displayStartIndex === -1) {
    return {
      contextSnapshots: rawSeries.slice(-1),
      displaySnapshots: rawSeries.slice(-1),
      displayStartIndex: rawSeries.length - 1,
    };
  }

  const contextStartIndex = Math.max(0, displayStartIndex - 1);

  return {
    contextSnapshots: rawSeries.slice(contextStartIndex),
    displaySnapshots: rawSeries.slice(displayStartIndex),
    displayStartIndex,
  };
}

function detectDailyRolloverMeta(bucketTotals, thresholds = {}) {
  const {
    pendingHigh = 2.5,
    pendingLow = 2.0,
    minPendingDrop = 0.75,
    minClaimableResetDrop = 0.35,
  } = thresholds;

  if (!Array.isArray(bucketTotals) || bucketTotals.length < 2) return null;

  let runningMaxBeforeRollover = safeNumber(
    bucketTotals[0]?.claimable_total_usd ?? bucketTotals[0]?.total_claimable_usd
  );

  for (let i = 1; i < bucketTotals.length; i += 1) {
    const prev = bucketTotals[i - 1];
    const current = bucketTotals[i];

    const prevPending = safeNumber(
      prev.pending_total_usd ?? prev.total_pending_usd
    );
    const currentPending = safeNumber(
      current.pending_total_usd ?? current.total_pending_usd
    );
    const pendingDrop = prevPending - currentPending;

    const currentClaimable = safeNumber(
      current.claimable_total_usd ?? current.total_claimable_usd
    );
    const claimableResetDrop = runningMaxBeforeRollover - currentClaimable;

    const pendingResetDetected =
      prevPending >= pendingHigh &&
      currentPending <= pendingLow &&
      pendingDrop >= minPendingDrop;

    const claimableResetDetected =
      currentPending <= pendingLow &&
      claimableResetDrop >= minClaimableResetDrop;

    if (pendingResetDetected || claimableResetDetected) {
      return {
        rolloverIndex: i,
        prevBucket: prev,
        rolloverBucket: current,
        rolloverSnapshotTime: current.snapshot_time,
        resetBaselineClaimableUsd: runningMaxBeforeRollover,
        pendingResetDetected,
        claimableResetDetected,
        claimableResetDrop,
      };
    }

    runningMaxBeforeRollover = Math.max(
      runningMaxBeforeRollover,
      safeNumber(prev.claimable_total_usd ?? prev.total_claimable_usd),
      currentClaimable
    );
  }

  return null;
}

function buildDailySummary(snapshots, timeframeStartIso, thresholds = {}) {
  const fullBucketSeries = buildBucketTotals(snapshots, "daily");
  const currentTotals = buildLatestCurrentTotals(snapshots);
  const { displayBuckets } = splitDailyBucketSeriesForWindow(
    fullBucketSeries,
    timeframeStartIso
  );

  const rawDailySeries = buildRawDailySnapshotSeries(snapshots);
  const { contextSnapshots } = splitRawDailySnapshotsForWindow(
    rawDailySeries,
    timeframeStartIso
  );

  const rolloverMeta = detectDailyRolloverMeta(contextSnapshots, thresholds);

  const portfolioValues = displayBuckets.map((row) =>
    safeNumber(row.total_value_usd)
  );
  const claimableValues = displayBuckets.map((row) =>
    safeNumber(row.total_claimable_usd)
  );

  const avgPortfolio = getAverage(portfolioValues);
  const minPortfolio = getMin(portfolioValues);
  const maxPortfolio = getMax(portfolioValues);

  let avgClaimable = getAverage(claimableValues);
  let minClaimable = getMin(claimableValues, { ignoreZero: true });
  let maxClaimable = getMax(claimableValues);
  let currentYieldFlow = getRangeFlow(maxClaimable, minClaimable);

  let effectiveRolloverMeta = null;

  if (displayBuckets.length > 0 && rolloverMeta) {
    const rolloverTimeMs = new Date(rolloverMeta.rolloverSnapshotTime).getTime();
    const startMs = new Date(timeframeStartIso).getTime();

    if (rolloverTimeMs >= startMs) {
      const postRolloverClaimables = displayBuckets
        .filter(
          (row) => new Date(row.snapshot_time).getTime() >= rolloverTimeMs
        )
        .map((row) => safeNumber(row.total_claimable_usd));

      const resetSeries = [
        safeNumber(rolloverMeta.resetBaselineClaimableUsd),
        ...postRolloverClaimables,
      ];

      minClaimable = safeNumber(rolloverMeta.resetBaselineClaimableUsd);
      maxClaimable = getMax(resetSeries);
      avgClaimable = getAverage(resetSeries);
      currentYieldFlow = getRangeFlow(maxClaimable, minClaimable);
      effectiveRolloverMeta = rolloverMeta;
    } else {
      minClaimable = safeNumber(claimableValues[0] ?? 0);
      maxClaimable = getMax(claimableValues);
      avgClaimable = getAverage(claimableValues);
      currentYieldFlow = getRangeFlow(maxClaimable, minClaimable);
    }
  } else if (claimableValues.length > 0) {
    minClaimable = safeNumber(claimableValues[0]);
    maxClaimable = getMax(claimableValues);
    avgClaimable = getAverage(claimableValues);
    currentYieldFlow = getRangeFlow(maxClaimable, minClaimable);
  }

  return {
    mode: "daily_summary",
    snapshot_time: currentTotals.snapshot_time,
    label: formatDailyLabel(currentTotals.snapshot_time),
    metric_label: `${capitalizeTimeframe("daily")} Yield Flow`,
    total_value_usd: currentTotals.total_value_usd,
    total_claimable_usd: currentTotals.total_claimable_usd,
    current_yield_flow_usd: currentYieldFlow,
    avg_total_value_usd: avgPortfolio,
    min_total_value_usd: minPortfolio,
    max_total_value_usd: maxPortfolio,
    range_min_to_max_total_value_pct: getPctChange(minPortfolio, maxPortfolio),
    range_current_to_max_total_value_pct: getPctChange(
      currentTotals.total_value_usd,
      maxPortfolio
    ),
    avg_total_claimable_usd: avgClaimable,
    min_total_claimable_usd: minClaimable,
    max_total_claimable_usd: maxClaimable,
    range_min_to_max_total_claimable_pct: getPctChange(
      minClaimable,
      maxClaimable
    ),
    range_current_to_max_total_claimable_pct: getPctChange(
      maxClaimable,
      minClaimable
    ),
    snapshot_count: displayBuckets.length,
    daily_rollover_debug: {
      detected: Boolean(effectiveRolloverMeta),
      rollover_index: effectiveRolloverMeta?.rolloverIndex ?? null,
      rollover_snapshot_time: effectiveRolloverMeta?.rolloverSnapshotTime ?? null,
      reset_baseline_claimable_usd:
        effectiveRolloverMeta?.resetBaselineClaimableUsd ?? null,
      pending_reset_detected: effectiveRolloverMeta?.pendingResetDetected ?? false,
      claimable_reset_detected:
        effectiveRolloverMeta?.claimableResetDetected ?? false,
      claimable_reset_drop: effectiveRolloverMeta?.claimableResetDrop ?? null,
      reset_min_claimable_usd: minClaimable,
      max_post_rollover_claimable_usd: maxClaimable,
      avg_post_rollover_claimable_usd: avgClaimable,
      effective_daily_current_usd: currentYieldFlow,
      raw_context_snapshot_count: contextSnapshots.length,
      display_bucket_count: displayBuckets.length,
    },
  };
}

function computeGlobalDailyYieldFlow(
  snapshots,
  timeframeStartIso,
  thresholds = {}
) {
  const dailySummary = buildDailySummary(snapshots, timeframeStartIso, thresholds);
  return safeNumber(dailySummary.current_yield_flow_usd);
}

module.exports = {
  safeNumber,
  capitalizeTimeframe,
  getTimeframeStart,
  getBucketKey,
  getPortfolioSnapshotValue,
  getClaimableSnapshotValue,
  getPendingSnapshotValue,
  buildLatestPerWallet,
  buildLatestCurrentTotals,
  buildBucketTotals,
  splitDailyBucketTotalsForWindow,
  splitDailyBucketSeriesForWindow,
  buildRawDailySnapshotSeries,
  splitRawDailySnapshotsForWindow,
  detectDailyRolloverMeta,
  getAverageValue,
  getAverage,
  getMinValue,
  getMin,
  getMaxValue,
  getMax,
  getPctChange,
  getChangePctFromMin,
  getRangeFlow,
  getUtcDayStartIso,
  formatDailyLabel,
  makeTrendBucketLabel,
  buildDailySummary,
  computeGlobalDailyYieldFlow,
};