import { safeNumber } from "../utils.js";

const MAMO_PROTOCOL = "mamo";
const RESET_MIN_PREVIOUS_USD = 0.05;
const RESET_MIN_DROP_USD = 0.02;
const RESET_RELATIVE_FACTOR = 0.35;

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isRewardHolding(holding) {
  return normalizeText(holding?.category) === "reward";
}

function isMamoRewardHolding(holding) {
  return (
    isRewardHolding(holding) &&
    normalizeText(holding?.protocol) === MAMO_PROTOCOL
  );
}

function sumUsd(rows = []) {
  return rows.reduce((sum, row) => sum + safeNumber(row?.value_usd || 0), 0);
}

function getMamoRewardRows(rows = []) {
  return rows.filter(isMamoRewardHolding);
}

function buildDistribution(rows = []) {
  const totalUsd = sumUsd(rows);

  if (totalUsd <= 0) {
    return [];
  }

  return rows.map((row) => ({
    token_symbol: String(row?.token_symbol || "").trim(),
    weight: safeNumber(row?.value_usd || 0) / totalUsd,
  }));
}

function detectReset(previousUsd, currentUsd) {
  const prev = safeNumber(previousUsd);
  const curr = safeNumber(currentUsd);
  const drop = prev - curr;

  if (prev < RESET_MIN_PREVIOUS_USD) {
    return false;
  }

  return curr <= prev * RESET_RELATIVE_FACTOR && drop >= RESET_MIN_DROP_USD;
}

function getWeightMap(currentRows = [], lastDistribution = []) {
  const currentTotalUsd = sumUsd(currentRows);

  if (currentTotalUsd > 0) {
    return new Map(
      currentRows.map((row) => [
        String(row?.token_symbol || "").trim().toUpperCase(),
        safeNumber(row?.value_usd || 0) / currentTotalUsd,
      ])
    );
  }

  if (lastDistribution.length > 0) {
    return new Map(
      lastDistribution.map((item) => [
        String(item.token_symbol || "").trim().toUpperCase(),
        safeNumber(item.weight || 0),
      ])
    );
  }

  const equalWeight = currentRows.length > 0 ? 1 / currentRows.length : 0;

  return new Map(
    currentRows.map((row) => [
      String(row?.token_symbol || "").trim().toUpperCase(),
      equalWeight,
    ])
  );
}

function distributeAccruedUsd(rows = [], totalAccruedUsd = 0, lastDistribution = []) {
  if (rows.length === 0) {
    return [];
  }

  const weights = getWeightMap(rows, lastDistribution);
  const safeAccrued = safeNumber(totalAccruedUsd);

  let remaining = safeAccrued;

  return rows.map((row, index) => {
    const tokenSymbol = String(row?.token_symbol || "").trim().toUpperCase();
    const weight = safeNumber(weights.get(tokenSymbol) || 0);

    const assignedValue =
      index === rows.length - 1 ? remaining : safeAccrued * weight;

    remaining -= assignedValue;

    return {
      ...row,
      value_usd: Math.max(0, assignedValue),
      price_per_unit_usd:
        safeNumber(row?.price_per_unit_usd || 0) > 0
          ? safeNumber(row.price_per_unit_usd)
          : 0,
    };
  });
}

export function applySnapshotTransforms({
  snapshotTime,
  rawHoldings,
  daySnapshots,
}) {
  const safeHoldings = Array.isArray(rawHoldings) ? rawHoldings : [];
  const safeDaySnapshots = Array.isArray(daySnapshots) ? daySnapshots : [];

  const currentMamoRewardRows = getMamoRewardRows(safeHoldings);

  if (currentMamoRewardRows.length === 0) {
    return {
      holdings: safeHoldings,
      mamo: {
        hasRewards: false,
        currentPendingUsd: 0,
        completedCyclesUsd: 0,
        dailyAccruedUsd: 0,
        rewardsTokenSymbol: null,
      },
    };
  }

  const orderedHistory = [...safeDaySnapshots].sort(
    (a, b) =>
      new Date(a?.snapshot_time || 0).getTime() -
      new Date(b?.snapshot_time || 0).getTime()
  );

  let completedCyclesUsd = 0;
  let previousPendingUsd = 0;
  let lastDistribution = [];

  for (const snapshot of orderedHistory) {
    const historicalRows = getMamoRewardRows(snapshot?.holdings || []);
    const historicalPendingUsd = sumUsd(historicalRows);

    if (detectReset(previousPendingUsd, historicalPendingUsd)) {
      completedCyclesUsd += previousPendingUsd;
    }

    if (historicalPendingUsd > 0) {
      lastDistribution = buildDistribution(historicalRows);
    }

    previousPendingUsd = historicalPendingUsd;
  }

  const currentPendingUsd = sumUsd(currentMamoRewardRows);

  if (detectReset(previousPendingUsd, currentPendingUsd)) {
    completedCyclesUsd += previousPendingUsd;
  }

  const dailyAccruedUsd = completedCyclesUsd + currentPendingUsd;
  const adjustedMamoRewardRows = distributeAccruedUsd(
    currentMamoRewardRows,
    dailyAccruedUsd,
    lastDistribution
  );

  let rewardIndex = 0;
  const transformedHoldings = safeHoldings.map((holding) => {
    if (!isMamoRewardHolding(holding)) {
      return holding;
    }

    const nextRow = adjustedMamoRewardRows[rewardIndex];
    rewardIndex += 1;

    return nextRow || holding;
  });

  return {
    holdings: transformedHoldings,
    mamo: {
      hasRewards: true,
      currentPendingUsd,
      completedCyclesUsd,
      dailyAccruedUsd,
      rewardsTokenSymbol: "MAMO",
    },
  };
}