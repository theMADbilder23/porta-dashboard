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

function getBucketKey(dateString, timeframe) {
  const d = new Date(dateString);

  switch (timeframe) {
    case "daily": {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const hh = String(d.getUTCHours()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${hh}:00`;
    }

    case "weekly": {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    case "monthly": {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      return `${yyyy}-${mm}`;
    }

    case "quarterly": {
      const yyyy = d.getUTCFullYear();
      const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
      return `${yyyy}-Q${quarter}`;
    }

    case "yearly":
    default:
      return String(d.getUTCFullYear());
  }
}

function makeBucketLabel(bucketKey, timeframe) {
  if (timeframe === "daily") {
    const [datePart, hourPart] = bucketKey.split(" ");
    const d = new Date(`${datePart}T${hourPart}:00:00Z`);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    });
  }

  if (timeframe === "weekly") {
    const d = new Date(`${bucketKey}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  if (timeframe === "monthly") {
    const [year, month] = bucketKey.split("-");
    const d = new Date(`${year}-${month}-01T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (timeframe === "quarterly") {
    return bucketKey;
  }

  return bucketKey;
}

module.exports = async function handler(req, res) {
  try {
    const timeframe = String(req.query.timeframe || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id")
      .eq("is_active", true);

    if (walletsError) {
      throw walletsError;
    }

    const walletIds = Array.isArray(wallets) ? wallets.map((w) => w.id) : [];

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

    // Step 1: for each (bucket + wallet), keep ONLY the latest snapshot
    const latestPerWalletPerBucket = new Map();

    for (const snapshot of snapshots) {
      const bucketKey = getBucketKey(snapshot.snapshot_time, timeframe);
      const compositeKey = `${bucketKey}__${snapshot.wallet_id}`;
      const existing = latestPerWalletPerBucket.get(compositeKey);

      if (
        !existing ||
        new Date(snapshot.snapshot_time).getTime() >
          new Date(existing.snapshot_time).getTime()
      ) {
        latestPerWalletPerBucket.set(compositeKey, {
          bucketKey,
          wallet_id: snapshot.wallet_id,
          snapshot_time: snapshot.snapshot_time,
          total_value_usd: safeNumber(snapshot.total_value_usd),
          total_claimable_usd: safeNumber(snapshot.total_claimable_usd),
        });
      }
    }

    // Step 2: sum latest wallet snapshots inside each bucket
    const bucketTotals = new Map();

    for (const entry of latestPerWalletPerBucket.values()) {
      if (!bucketTotals.has(entry.bucketKey)) {
        bucketTotals.set(entry.bucketKey, {
          bucketKey: entry.bucketKey,
          snapshot_time: entry.snapshot_time,
          total_value_usd: 0,
          total_claimable_usd: 0,
        });
      }

      const bucket = bucketTotals.get(entry.bucketKey);
      bucket.total_value_usd += entry.total_value_usd;
      bucket.total_claimable_usd += entry.total_claimable_usd;

      if (
        new Date(entry.snapshot_time).getTime() >
        new Date(bucket.snapshot_time).getTime()
      ) {
        bucket.snapshot_time = entry.snapshot_time;
      }
    }

    const result = Array.from(bucketTotals.values())
      .sort(
        (a, b) =>
          new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime()
      )
      .map((bucket) => ({
        snapshot_time: bucket.snapshot_time,
        label: makeBucketLabel(bucket.bucketKey, timeframe),
        total_value_usd: bucket.total_value_usd,
        total_claimable_usd: bucket.total_claimable_usd,
      }));

    return res.status(200).json(result);
  } catch (err) {
    console.error("[api/performance] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};