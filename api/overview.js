const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDM", "DAI"]);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSymbol(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeRole(value) {
  return normalizeText(value).toLowerCase();
}

function isStableSymbol(symbol) {
  return STABLE_SYMBOLS.has(normalizeSymbol(symbol));
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

  return last - first >= (MIN_TIME_SPAN_MS[timeframe] || MIN_TIME_SPAN_MS.daily);
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
  return safeNumber(snapshot.total_value_usd) + safeNumber(snapshot.total_claimable_usd);
}

function getClaimableSnapshotValue(snapshot) {
  return safeNumber(snapshot.total_claimable_usd);
}

function buildLatestPerWallet(snapshots) {
  const latestPerWallet = new Map();

  for (const snapshot of snapshots) {
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

function buildBucketTotals(snapshots, timeframe) {
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
      latestPerWalletPerBucket.set(compositeKey, snapshot);
    }
  }

  const bucketTotals = new Map();

  for (const [compositeKey, snapshot] of latestPerWalletPerBucket.entries()) {
    const bucketKey = compositeKey.split("__")[0];

    if (!bucketTotals.has(bucketKey)) {
      bucketTotals.set(bucketKey, {
        bucket_key: bucketKey,
        portfolio_total_usd: 0,
        claimable_total_usd: 0,
      });
    }

    const bucket = bucketTotals.get(bucketKey);
    bucket.portfolio_total_usd += getPortfolioSnapshotValue(snapshot);
    bucket.claimable_total_usd += getClaimableSnapshotValue(snapshot);
  }

  return Array.from(bucketTotals.values()).sort((a, b) =>
    a.bucket_key.localeCompare(b.bucket_key)
  );
}

function getMinValue(values, { ignoreZero = false } = {}) {
  const filtered = (values || [])
    .map((v) => safeNumber(v))
    .filter((v) => (ignoreZero ? v > 0 : true));

  if (filtered.length === 0) return 0;
  return Math.min(...filtered);
}

function getChangePctFromMin(current, min) {
  const currentValue = safeNumber(current);
  const minValue = safeNumber(min);

  if (minValue <= 0) return null;
  return (currentValue - minValue) / minValue;
}

function getEmptyResponse(timeframe) {
  return {
    timeframe,
    total_portfolio_value: null,
    stable_value: null,
    rotational_value: null,
    growth_value: null,
    swing_value: null,
    realized_gains: null,
    realized_losses: null,
    passive_income: null,
    total_portfolio_value_change_pct: null,
    passive_income_change_pct: null,
    realized_gains_change_pct: null,
    realized_losses_change_pct: null,
    allocation_scope_label: "Tracked dashboard assets only",
  };
}

function classifyHolding({ role, tokenSymbol, category, protocol }) {
  const normalizedRole = normalizeRole(role);
  const normalizedCategory = normalizeRole(category);
  const hasProtocol = normalizeText(protocol).length > 0;

  // Step 1: Swing wins first
  if (normalizedRole === "swing") {
    return "swing";
  }

  // Step 2: Stable Core next
  if (
    isStableSymbol(tokenSymbol) &&
    normalizedCategory === "protocol" &&
    hasProtocol
  ) {
    return "stable";
  }

  // Step 3: Growth next
  if (normalizedRole === "yield" || normalizedRole === "hub") {
    return "growth";
  }

  // Step 4: Rotational Core fallback
  if (normalizedRole === "core") {
    return "rotational";
  }

  return "growth";
}

module.exports = async function handler(req, res) {
  try {
    const timeframe = String(req.query.timeframe || "daily").toLowerCase();
    const timeframeStart = getTimeframeStart(timeframe).toISOString();

    const { data: wallets, error: walletsError } = await supabase
      .from("Wallets")
      .select("id, role, is_active")
      .eq("is_active", true);

    if (walletsError) throw walletsError;

    const activeWallets = Array.isArray(wallets) ? wallets : [];
    const walletIds = activeWallets.map((wallet) => wallet.id);

    if (walletIds.length === 0) {
      return res.status(200).json(getEmptyResponse(timeframe));
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

    const allSnapshots = Array.isArray(snapshots) ? snapshots : [];

    if (allSnapshots.length === 0) {
      return res.status(200).json(getEmptyResponse(timeframe));
    }

    if (timeframe !== "daily" && !hasEnoughTimeCoverage(allSnapshots, timeframe)) {
      return res.status(200).json(getEmptyResponse(timeframe));
    }

    const latestPerWallet = buildLatestPerWallet(allSnapshots);
    const latestSnapshots = Array.from(latestPerWallet.values());
    const latestSnapshotIds = latestSnapshots.map((snapshot) => snapshot.id);

    const bucketTotals = buildBucketTotals(allSnapshots, timeframe);

    const walletRoleMap = new Map(
      activeWallets.map((wallet) => [wallet.id, normalizeRole(wallet.role)])
    );

    let latestHoldings = [];

    if (latestSnapshotIds.length > 0) {
      const { data: holdings, error: holdingsError } = await supabase
        .from("wallet_holdings")
        .select(`
          wallet_id,
          snapshot_id,
          token_symbol,
          value_usd,
          category,
          protocol
        `)
        .in("snapshot_id", latestSnapshotIds);

      if (holdingsError) throw holdingsError;

      latestHoldings = Array.isArray(holdings) ? holdings : [];
    }

    const holdingsBySnapshotId = new Map();

    for (const holding of latestHoldings) {
      const snapshotId = holding.snapshot_id;
      if (!holdingsBySnapshotId.has(snapshotId)) {
        holdingsBySnapshotId.set(snapshotId, []);
      }
      holdingsBySnapshotId.get(snapshotId).push(holding);
    }

    let totalPortfolioValue = 0;
    let passiveIncome = 0;

    let stableValue = 0;
    let rotationalValue = 0;
    let growthValue = 0;
    let swingValue = 0;

    for (const snapshot of latestSnapshots) {
      const walletId = snapshot.wallet_id;
      const role = walletRoleMap.get(walletId) || "";
      const portfolioValue = getPortfolioSnapshotValue(snapshot);
      const claimableValue = getClaimableSnapshotValue(snapshot);

      totalPortfolioValue += portfolioValue;
      passiveIncome += claimableValue;

      const holdings = holdingsBySnapshotId.get(snapshot.id) || [];
      let classifiedWalletValue = 0;

      for (const holding of holdings) {
        const value = safeNumber(holding.value_usd);
        if (value <= 0) continue;

        const bucket = classifyHolding({
          role,
          tokenSymbol: holding.token_symbol,
          category: holding.category,
          protocol: holding.protocol,
        });

        classifiedWalletValue += value;

        if (bucket === "stable") stableValue += value;
        else if (bucket === "rotational") rotationalValue += value;
        else if (bucket === "growth") growthValue += value;
        else if (bucket === "swing") swingValue += value;
      }

      // Remainder fallback so totals still reconcile to current tracked dashboard value.
      const remainder = Math.max(0, portfolioValue - classifiedWalletValue);

      if (remainder > 0) {
        const fallbackBucket = classifyHolding({
          role,
          tokenSymbol: null,
          category: null,
          protocol: null,
        });

        if (fallbackBucket === "stable") stableValue += remainder;
        else if (fallbackBucket === "rotational") rotationalValue += remainder;
        else if (fallbackBucket === "growth") growthValue += remainder;
        else if (fallbackBucket === "swing") swingValue += remainder;
      }
    }

    const portfolioBucketValues = bucketTotals.map((bucket) => bucket.portfolio_total_usd);
    const claimableBucketValues = bucketTotals.map((bucket) => bucket.claimable_total_usd);

    const minPortfolioValue = getMinValue(portfolioBucketValues);
    const minPassiveIncome = getMinValue(claimableBucketValues, { ignoreZero: true });

    return res.status(200).json({
      timeframe,
      total_portfolio_value: totalPortfolioValue,
      stable_value: stableValue,
      rotational_value: rotationalValue,
      growth_value: growthValue,
      swing_value: swingValue,
      realized_gains: null,
      realized_losses: null,
      passive_income: passiveIncome,
      total_portfolio_value_change_pct: getChangePctFromMin(
        totalPortfolioValue,
        minPortfolioValue
      ),
      passive_income_change_pct: getChangePctFromMin(
        passiveIncome,
        minPassiveIncome
      ),
      realized_gains_change_pct: null,
      realized_losses_change_pct: null,
      allocation_scope_label: "Tracked dashboard assets only",
    });
  } catch (err) {
    console.error("[api/overview] error:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || "Unknown error",
    });
  }
};