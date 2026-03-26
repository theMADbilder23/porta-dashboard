const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d;
    }
  }
}

const MIN_TIME_SPAN_MS = {
  daily: 12 * 60 * 60 * 1000,
  weekly: 5 * 24 * 60 * 60 * 1000,
  monthly: 21 * 24 * 60 * 60 * 1000,
  quarterly: 60 * 24 * 60 * 60 * 1000,
  yearly: 275 * 24 * 60 * 60 * 1000,
};

function hasEnoughTimeCoverage(snapshots, timeframe) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return false;

  const first = new Date(snapshots[0].snapshot_time).getTime();
  const last = new Date(snapshots[snapshots.length - 1].snapshot_time).getTime();

  if (!Number.isFinite(first) || !Number.isFinite(last)) return false;

  const span = last - first;
  return span >= (MIN_TIME_SPAN_MS[timeframe] || MIN_TIME_SPAN_MS.daily);
}

function getPortfolioSnapshotValue(snapshot) {
  if (!snapshot) return 0;

  return (
    safeNumber(snapshot.total_value_usd) +
    safeNumber(snapshot.total_claimable_usd)
  );
}

function getClaimableValue(snapshot) {
  if (!snapshot) return 0;
  return safeNumber(snapshot.total_claimable_usd);
}

function getPositiveClaimableAccrual(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return 0;
  if (snapshots.length === 1) return getClaimableValue(snapshots[0]);

  let totalAccrued = 0;

  for (let i = 1; i < snapshots.length; i += 1) {
    const previous = getClaimableValue(snapshots[i - 1]);
    const current = getClaimableValue(snapshots[i]);

    if (current > previous) {
      totalAccrued += current - previous;
    }
  }

  return totalAccrued;
}

function getChangePct(currentValue, previousValue) {
  const current = safeNumber(currentValue);
  const previous = safeNumber(previousValue);

  if (previous <= 0) return null;

  return (current - previous) / previous;
}

module.exports = async function handler(req, res) {
  try {
    const timeframe = String(req.query.timeframe || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, name, role, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const walletIds = activeWallets.map((w) => w.id);

    if (walletIds.length === 0) {
      return res.status(200).json({
        timeframe,
        total_portfolio_value: null,
        stable_value: null,
        yield_value: null,
        growth_value: null,
        swing_value: null,
        realized_gains: null,
        realized_losses: null,
        passive_income: null,
        total_portfolio_value_change_pct: null,
        passive_income_change_pct: null,
        realized_gains_change_pct: null,
        realized_losses_change_pct: null,
      });
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(`
        id,
        wallet_id,
        total_value_usd,
        total_claimable_usd,
        snapshot_time
      `)
      .in("wallet_id", walletIds)
      .gte("snapshot_time", timeframeStart)
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) throw snapshotsError;

    const snapshotsByWallet = new Map();

    for (const snapshot of snapshots || []) {
      if (!snapshotsByWallet.has(snapshot.wallet_id)) {
        snapshotsByWallet.set(snapshot.wallet_id, []);
      }
      snapshotsByWallet.get(snapshot.wallet_id).push(snapshot);
    }

    let totalPortfolioValue = 0;
    let stableValue = 0;
    let yieldValue = 0;
    let growthValue = 0;
    let swingValue = 0;
    let passiveIncome = 0;

    let totalPreviousPortfolioValue = 0;
    let totalPreviousPassiveIncome = 0;

    let portfolioWalletsUsed = 0;
    let passiveWalletsUsed = 0;
    let portfolioChangeWalletsUsed = 0;
    let passiveChangeWalletsUsed = 0;

    for (const wallet of activeWallets) {
      const walletSnapshots = snapshotsByWallet.get(wallet.id) || [];
      const role = String(wallet.role || "").toLowerCase();

      const hasCoverage =
        timeframe === "daily"
          ? walletSnapshots.length >= 1
          : hasEnoughTimeCoverage(walletSnapshots, timeframe);

      if (!hasCoverage) {
        continue;
      }

      const latestSnapshot = walletSnapshots[walletSnapshots.length - 1];

      let portfolioValueForTimeframe = 0;
      let passiveIncomeForTimeframe = 0;
      let previousPortfolioValueForTimeframe = null;
      let previousPassiveIncomeForTimeframe = null;

      if (timeframe === "daily") {
        portfolioValueForTimeframe = getPortfolioSnapshotValue(latestSnapshot);
        passiveIncomeForTimeframe = getClaimableValue(latestSnapshot);

        if (walletSnapshots.length >= 2) {
          const previousSnapshot = walletSnapshots[walletSnapshots.length - 2];
          previousPortfolioValueForTimeframe = getPortfolioSnapshotValue(previousSnapshot);
          previousPassiveIncomeForTimeframe = getClaimableValue(previousSnapshot);
        }
      } else {
        let portfolioSum = 0;

        for (const snapshot of walletSnapshots) {
          portfolioSum += getPortfolioSnapshotValue(snapshot);
        }

        portfolioValueForTimeframe = portfolioSum / walletSnapshots.length;
        passiveIncomeForTimeframe = getPositiveClaimableAccrual(walletSnapshots);

        const firstSnapshot = walletSnapshots[0];
        previousPortfolioValueForTimeframe = getPortfolioSnapshotValue(firstSnapshot);
        previousPassiveIncomeForTimeframe = getClaimableValue(firstSnapshot);
      }

      totalPortfolioValue += portfolioValueForTimeframe;
      passiveIncome += passiveIncomeForTimeframe;

      portfolioWalletsUsed += 1;
      passiveWalletsUsed += 1;

      if (previousPortfolioValueForTimeframe != null) {
        totalPreviousPortfolioValue += previousPortfolioValueForTimeframe;
        portfolioChangeWalletsUsed += 1;
      }

      if (previousPassiveIncomeForTimeframe != null) {
        totalPreviousPassiveIncome += previousPassiveIncomeForTimeframe;
        passiveChangeWalletsUsed += 1;
      }

      if (role === "hub") {
        stableValue += portfolioValueForTimeframe;
      } else if (role === "yield") {
        yieldValue += portfolioValueForTimeframe;
      } else if (role === "core") {
        growthValue += portfolioValueForTimeframe;
      } else if (role === "swing") {
        swingValue += portfolioValueForTimeframe;
      } else {
        growthValue += portfolioValueForTimeframe;
      }
    }

    const totalPortfolioValueChangePct =
      portfolioChangeWalletsUsed > 0
        ? getChangePct(totalPortfolioValue, totalPreviousPortfolioValue)
        : null;

    const passiveIncomeChangePct =
      passiveChangeWalletsUsed > 0
        ? getChangePct(passiveIncome, totalPreviousPassiveIncome)
        : null;

    return res.status(200).json({
      timeframe,
      total_portfolio_value: portfolioWalletsUsed > 0 ? totalPortfolioValue : null,
      stable_value: portfolioWalletsUsed > 0 ? stableValue : null,
      yield_value: portfolioWalletsUsed > 0 ? yieldValue : null,
      growth_value: portfolioWalletsUsed > 0 ? growthValue : null,
      swing_value: portfolioWalletsUsed > 0 ? swingValue : null,
      realized_gains: null,
      realized_losses: null,
      passive_income: passiveWalletsUsed > 0 ? passiveIncome : null,
      total_portfolio_value_change_pct: totalPortfolioValueChangePct,
      passive_income_change_pct: passiveIncomeChangePct,
      realized_gains_change_pct: null,
      realized_losses_change_pct: null,
    });
  } catch (err) {
    console.error("[api/overview] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};