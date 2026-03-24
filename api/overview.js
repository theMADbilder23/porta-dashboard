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

export default async function handler(req, res) {
  try {
    const timeframe = String(req.query.timeframe || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("wallets")
      .select("id, name, role, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const walletIds = activeWallets.map((w) => w.id);

    if (walletIds.length === 0) {
      return res.status(200).json({
        timeframe,
        total_portfolio_value: 0,
        stable_value: 0,
        yield_value: 0,
        growth_value: 0,
        swing_value: 0,
        realized_gains: null,
        realized_losses: null,
        passive_income: 0,
      });
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select(
        "id, wallet_id, total_value_usd, total_rewards_usd, total_pending_usd, snapshot_time"
      )
      .in("wallet_id", walletIds)
      .gte("snapshot_time", timeframeStart)
      .order("snapshot_time", { ascending: false });

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

    for (const wallet of activeWallets) {
      const walletSnapshots = snapshotsByWallet.get(wallet.id) || [];
      if (walletSnapshots.length === 0) continue;

      let portfolioSum = 0;
      let passiveIncomeSum = 0;

      for (const snapshot of walletSnapshots) {
        const snapshotPortfolioValue =
          safeNumber(snapshot.total_value_usd) + safeNumber(snapshot.total_pending_usd);

        const snapshotPassiveIncome =
          safeNumber(snapshot.total_rewards_usd) + safeNumber(snapshot.total_pending_usd);

        portfolioSum += snapshotPortfolioValue;
        passiveIncomeSum += snapshotPassiveIncome;
      }

      const avgPortfolioValue = portfolioSum / walletSnapshots.length;
      const avgPassiveIncome = passiveIncomeSum / walletSnapshots.length;
      const role = String(wallet.role || "").toLowerCase();

      totalPortfolioValue += avgPortfolioValue;
      passiveIncome += avgPassiveIncome;

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
    }

    return res.status(200).json({
      timeframe,
      total_portfolio_value: totalPortfolioValue,
      stable_value: stableValue,
      yield_value: yieldValue,
      growth_value: growthValue,
      swing_value: swingValue,
      realized_gains: null,
      realized_losses: null,
      passive_income: passiveIncome,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
}