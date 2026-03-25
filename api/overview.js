import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const MIN_TIME_SPAN_MS = {
  daily: 12 * 60 * 60 * 1000, // 12 hours
  weekly: 5 * 24 * 60 * 60 * 1000, // 5 days
  monthly: 21 * 24 * 60 * 60 * 1000, // 21 days
  quarterly: 60 * 24 * 60 * 60 * 1000, // 60 days
  yearly: 275 * 24 * 60 * 60 * 1000, // 275 days
};

function hasEnoughTimeCoverage(snapshots, timeframe) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return false;

  const first = new Date(snapshots[0].snapshot_time).getTime();
  const last = new Date(snapshots[snapshots.length - 1].snapshot_time).getTime();

  if (!Number.isFinite(first) || !Number.isFinite(last)) return false;

  const span = last - first;
  return span >= (MIN_TIME_SPAN_MS[timeframe] || MIN_TIME_SPAN_MS.daily);
}

export default async function handler(req, res) {
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
      });
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(
        "id, wallet_id, total_value_usd, total_rewards_usd, total_pending_usd, snapshot_time"
      )
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

    let portfolioWalletsUsed = 0;
    let passiveWalletsUsed = 0;

    for (const wallet of activeWallets) {
      const walletSnapshots = snapshotsByWallet.get(wallet.id) || [];
      const role = String(wallet.role || "").toLowerCase();

      if (!hasEnoughTimeCoverage(walletSnapshots, timeframe)) {
        continue;
      }

      let portfolioSum = 0;

      for (const snapshot of walletSnapshots) {
        portfolioSum +=
          safeNumber(snapshot.total_value_usd) +
          safeNumber(snapshot.total_pending_usd);
      }

      const avgPortfolioValue = portfolioSum / walletSnapshots.length;

      totalPortfolioValue += avgPortfolioValue;
      portfolioWalletsUsed += 1;

      if (role === "hub") {
        stableValue += avgPortfolioValue;
      } else if (role === "yield") {
        yieldValue += avgPortfolioValue;
      } else if (role === "core") {
        growthValue += avgPortfolioValue;
      } else if (role === "swing") {
        swingValue += avgPortfolioValue;
      } else {
        growthValue += avgPortfolioValue;
      }

      const firstSnapshot = walletSnapshots[0];
      const lastSnapshot = walletSnapshots[walletSnapshots.length - 1];

      const firstRewardState =
        safeNumber(firstSnapshot.total_rewards_usd) +
        safeNumber(firstSnapshot.total_pending_usd);

      const lastRewardState =
        safeNumber(lastSnapshot.total_rewards_usd) +
        safeNumber(lastSnapshot.total_pending_usd);

      const earnedInTimeframe = Math.max(0, lastRewardState - firstRewardState);

      passiveIncome += earnedInTimeframe;
      passiveWalletsUsed += 1;
    }

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
    });
  } catch (err) {
    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
}