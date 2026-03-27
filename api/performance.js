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

function makeBucketLabel(dateString, timeframe) {
  const d = new Date(dateString);

  switch (timeframe) {
    case "daily":
      return d.toLocaleDateString("en-US", { weekday: "short" });
    case "weekly":
      return `W${Math.ceil(d.getDate() / 7)}`;
    case "monthly":
      return d.toLocaleDateString("en-US", { month: "short" });
    case "quarterly":
      return `Q${Math.floor(d.getMonth() / 3) + 1}`;
    case "yearly":
      return String(d.getFullYear());
    default:
      return d.toLocaleDateString("en-US", { weekday: "short" });
  }
}

module.exports = async function handler(req, res) {
  try {
    const timeframe = String(req.query.timeframe || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, is_active")
      .eq("is_active", true);

    if (walletsError) {
      throw walletsError;
    }

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const walletIds = activeWallets.map((w) => w.id);

    if (walletIds.length === 0) {
      return res.status(200).json([]);
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("wallet_snapshots")
      .select("wallet_id, snapshot_time, total_value_usd, total_claimable_usd")
      .in("wallet_id", walletIds)
      .gte("snapshot_time", timeframeStart)
      .order("snapshot_time", { ascending: true });

    if (snapshotsError) {
      throw snapshotsError;
    }

    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      return res.status(200).json([]);
    }

    const grouped = new Map();

    for (const snapshot of snapshots) {
      const label = makeBucketLabel(snapshot.snapshot_time, timeframe);

      if (!grouped.has(label)) {
        grouped.set(label, {
          label,
          snapshot_time: snapshot.snapshot_time,
          total_value_usd: 0,
          total_claimable_usd: 0,
        });
      }

      const bucket = grouped.get(label);

      bucket.total_value_usd += safeNumber(snapshot.total_value_usd);
      bucket.total_claimable_usd += safeNumber(snapshot.total_claimable_usd);
      bucket.snapshot_time = snapshot.snapshot_time;
    }

    const result = Array.from(grouped.values());

    return res.status(200).json(result);
  } catch (err) {
    console.error("[api/performance] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};