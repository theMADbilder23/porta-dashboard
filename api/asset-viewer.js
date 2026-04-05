const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function decodeToken(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseAssetRoute(token) {
  const decoded = decodeToken(token);
  const [network = "unknown", symbol = decoded] = decoded.split(":");

  return {
    raw: decoded,
    network,
    networkLower: normalizeLower(network),
    symbol,
    symbolUpper: normalizeText(symbol).toUpperCase(),
    symbolLower: normalizeLower(symbol),
  };
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function formatTagSet(rows) {
  const tags = new Set();

  for (const row of rows) {
    const assetClass = normalizeLower(row.asset_class);
    const yieldProfile = normalizeLower(row.yield_profile);
    const mmiiBucket = normalizeLower(row.mmii_bucket);
    const protocol = normalizeLower(row.protocol);
    const category = normalizeLower(row.category);

    if (assetClass) tags.add(assetClass);
    if (yieldProfile && yieldProfile !== "none") tags.add(yieldProfile);
    if (mmiiBucket) tags.add(mmiiBucket);
    if (protocol) tags.add(protocol);
    if (category) tags.add(category);
    if (row.is_yield_position) tags.add("yield-tracked");
  }

  return Array.from(tags);
}

function pickPrimaryRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return [...rows].sort((a, b) => {
    const valueDiff = safeNumber(b.value_usd) - safeNumber(a.value_usd);
    if (valueDiff !== 0) return valueDiff;

    const snapshotDiff =
      new Date(b.snapshot_time || 0).getTime() -
      new Date(a.snapshot_time || 0).getTime();
    if (snapshotDiff !== 0) return snapshotDiff;

    return (
      safeNumber(b.price_per_unit_usd) - safeNumber(a.price_per_unit_usd)
    );
  })[0];
}

function aggregateRows(rows) {
  const totals = {
    total_amount: 0,
    total_value_usd: 0,
    principal_amount: 0,
    principal_value_usd: 0,
    reward_amount: 0,
    reward_value_usd: 0,
    yield_position_value_usd: 0,
    non_yield_position_value_usd: 0,
    wallet_count: 0,
  };

  const walletIds = new Set();

  for (const row of rows) {
    const amount = safeNumber(row.amount);
    const valueUsd = safeNumber(row.value_usd);
    const role = normalizeLower(row.position_role);

    totals.total_amount += amount;
    totals.total_value_usd += valueUsd;

    if (role === "reward") {
      totals.reward_amount += amount;
      totals.reward_value_usd += valueUsd;
    } else {
      totals.principal_amount += amount;
      totals.principal_value_usd += valueUsd;
    }

    if (row.is_yield_position) {
      totals.yield_position_value_usd += valueUsd;
    } else {
      totals.non_yield_position_value_usd += valueUsd;
    }

    if (row.wallet_id) {
      walletIds.add(row.wallet_id);
    }
  }

  totals.wallet_count = walletIds.size;

  return totals;
}

function buildWalletBreakdown(rows, walletMetaById) {
  const byWallet = new Map();

  for (const row of rows) {
    const walletId = row.wallet_id || "unknown";

    if (!byWallet.has(walletId)) {
      const walletMeta = walletMetaById.get(walletId);

      byWallet.set(walletId, {
        wallet_id: walletId,
        wallet_name: walletMeta?.name || "Unnamed Wallet",
        wallet_address: walletMeta?.wallet_address || null,
        network_group: walletMeta?.network_group || null,
        role: walletMeta?.role || null,
        total_amount: 0,
        total_value_usd: 0,
        principal_value_usd: 0,
        reward_value_usd: 0,
        latest_snapshot_time: row.snapshot_time || null,
        row_count: 0,
      });
    }

    const entry = byWallet.get(walletId);
    const valueUsd = safeNumber(row.value_usd);

    entry.total_amount += safeNumber(row.amount);
    entry.total_value_usd += valueUsd;
    entry.row_count += 1;

    if (normalizeLower(row.position_role) === "reward") {
      entry.reward_value_usd += valueUsd;
    } else {
      entry.principal_value_usd += valueUsd;
    }

    const currentTs = new Date(entry.latest_snapshot_time || 0).getTime();
    const rowTs = new Date(row.snapshot_time || 0).getTime();

    if (rowTs > currentTs) {
      entry.latest_snapshot_time = row.snapshot_time || null;
    }
  }

  return Array.from(byWallet.values()).sort(
    (a, b) => safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd)
  );
}

function rowMatchesRoute(row, route) {
  const rowAssetId = normalizeLower(row.asset_id);
  const rowNetwork = normalizeLower(row.network);
  const rowSymbol = normalizeLower(row.token_symbol);
  const rowTokenName = normalizeLower(row.token_name);

  const routeAssetId = normalizeLower(route.raw);
  const routeNetwork = route.networkLower;
  const routeSymbol = route.symbolLower;

  if (rowAssetId && rowAssetId === routeAssetId) return true;

  if (rowNetwork === routeNetwork && rowSymbol === routeSymbol) return true;

  if (rowNetwork === routeNetwork && rowTokenName === routeSymbol) return true;

  return false;
}

async function fetchWalletMeta(walletIds) {
  if (!Array.isArray(walletIds) || walletIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("Wallets")
    .select("id, name, wallet_address, network_group, role")
    .in("id", walletIds);

  if (error) {
    throw error;
  }

  const map = new Map();

  for (const wallet of Array.isArray(data) ? data : []) {
    map.set(wallet.id, wallet);
  }

  return map;
}

async function fetchCandidateRows(route) {
  const symbolCandidates = uniq([
    route.symbol,
    route.symbolUpper,
    route.symbolLower,
  ]);

  const { data, error } = await supabase
    .from("wallet_holdings")
    .select(
      `
      id,
      wallet_id,
      token_symbol,
      token_name,
      network,
      amount,
      value_usd,
      category,
      protocol,
      is_yield_position,
      asset_id,
      asset_class,
      yield_profile,
      mmii_bucket,
      mmii_subclass,
      price_source,
      price_per_unit_usd,
      position_role,
      snapshot_time,
      created_at
      `
    )
    .in("token_symbol", symbolCandidates)
    .order("snapshot_time", { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  const tokenRows = Array.isArray(data) ? data : [];

  const { data: broaderData, error: broaderError } = await supabase
    .from("wallet_holdings")
    .select(
      `
      id,
      wallet_id,
      token_symbol,
      token_name,
      network,
      amount,
      value_usd,
      category,
      protocol,
      is_yield_position,
      asset_id,
      asset_class,
      yield_profile,
      mmii_bucket,
      mmii_subclass,
      price_source,
      price_per_unit_usd,
      position_role,
      snapshot_time,
      created_at
      `
    )
    .order("snapshot_time", { ascending: false })
    .limit(1500);

  if (broaderError) {
    throw broaderError;
  }

  const combined = [...tokenRows, ...(Array.isArray(broaderData) ? broaderData : [])];

  const deduped = new Map();

  for (const row of combined) {
    if (!row?.id) continue;
    deduped.set(row.id, row);
  }

  return Array.from(deduped.values());
}

function reduceToLatestSnapshotRowsPerWallet(rows) {
  const latestSnapshotByWallet = new Map();

  for (const row of rows) {
    const walletId = row.wallet_id;
    if (!walletId) continue;

    const rowTs = new Date(row.snapshot_time || 0).getTime();
    const currentTs = latestSnapshotByWallet.has(walletId)
      ? latestSnapshotByWallet.get(walletId)
      : -Infinity;

    if (rowTs > currentTs) {
      latestSnapshotByWallet.set(walletId, rowTs);
    }
  }

  return rows.filter((row) => {
    const walletId = row.wallet_id;
    if (!walletId) return false;

    const rowTs = new Date(row.snapshot_time || 0).getTime();
    return latestSnapshotByWallet.get(walletId) === rowTs;
  });
}

function buildResponse({ route, rows, walletMetaById }) {
  const primaryRow = pickPrimaryRow(rows);
  const totals = aggregateRows(rows);
  const walletBreakdown = buildWalletBreakdown(rows, walletMetaById);

  const latestSnapshotTime = rows.reduce((latest, row) => {
    const rowTs = new Date(row.snapshot_time || 0).getTime();
    const latestTs = new Date(latest || 0).getTime();
    return rowTs > latestTs ? row.snapshot_time : latest;
  }, null);

  return {
    asset: {
      route_param: route.raw,
      asset_id: primaryRow?.asset_id || route.raw,
      token_symbol: primaryRow?.token_symbol || route.symbol,
      token_name: primaryRow?.token_name || route.symbol,
      network: primaryRow?.network || route.network,
      asset_class: primaryRow?.asset_class || "crypto",
      protocol: primaryRow?.protocol || null,
      category_tags: formatTagSet(rows),
      yield_profile: primaryRow?.yield_profile || "none",
      mmii_bucket: primaryRow?.mmii_bucket || "growth",
      mmii_subclass: primaryRow?.mmii_subclass || null,
      position_role:
        totals.reward_value_usd > 0 && totals.principal_value_usd > 0
          ? "mixed"
          : primaryRow?.position_role || "principal",
      is_yield_position: rows.some((row) => Boolean(row.is_yield_position)),
    },

    market: {
      price_per_unit_usd: safeNumber(primaryRow?.price_per_unit_usd),
      price_source: primaryRow?.price_source || null,
      change_24h_percent: null,
      change_7d_percent: null,
      market_cap_usd: null,
      fdv_usd: null,
      volume_24h_usd: null,
      liquidity_usd: null,
    },

    position: {
      total_amount: safeNumber(totals.total_amount),
      total_value_usd: safeNumber(totals.total_value_usd),
      principal_amount: safeNumber(totals.principal_amount),
      principal_value_usd: safeNumber(totals.principal_value_usd),
      reward_amount: safeNumber(totals.reward_amount),
      reward_value_usd: safeNumber(totals.reward_value_usd),
      yield_position_value_usd: safeNumber(totals.yield_position_value_usd),
      non_yield_position_value_usd: safeNumber(
        totals.non_yield_position_value_usd
      ),
      wallet_count: totals.wallet_count,
      wallet_breakdown: walletBreakdown,
    },

    latest_snapshot: {
      snapshot_time: latestSnapshotTime,
    },

    debug: {
      matched_rows: rows.length,
      matched_wallets: totals.wallet_count,
      resolver: "wallet_holdings_case_insensitive_js_match",
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const requested =
      req.query.asset || req.query.token || req.query.id || null;

    if (!requested) {
      return res.status(400).json({
        error: "Missing asset query param",
      });
    }

    const route = parseAssetRoute(requested);
    const candidateRows = await fetchCandidateRows(route);
    const matchedRows = candidateRows.filter((row) => rowMatchesRoute(row, route));
    const latestRows = reduceToLatestSnapshotRowsPerWallet(matchedRows);

    if (!latestRows.length) {
      return res.status(200).json({
        found: false,
        asset: {
          route_param: route.raw,
          asset_id: route.raw,
          token_symbol: route.symbol,
          token_name: route.symbol,
          network: route.network,
          asset_class: "crypto",
          protocol: null,
          category_tags: [],
          yield_profile: "none",
          mmii_bucket: "growth",
          mmii_subclass: null,
          position_role: "principal",
          is_yield_position: false,
        },
        market: {
          price_per_unit_usd: 0,
          price_source: null,
          change_24h_percent: null,
          change_7d_percent: null,
          market_cap_usd: null,
          fdv_usd: null,
          volume_24h_usd: null,
          liquidity_usd: null,
        },
        position: {
          total_amount: 0,
          total_value_usd: 0,
          principal_amount: 0,
          principal_value_usd: 0,
          reward_amount: 0,
          reward_value_usd: 0,
          yield_position_value_usd: 0,
          non_yield_position_value_usd: 0,
          wallet_count: 0,
          wallet_breakdown: [],
        },
        latest_snapshot: {
          snapshot_time: null,
        },
        debug: {
          matched_rows: 0,
          matched_wallets: 0,
          resolver: "wallet_holdings_case_insensitive_js_match",
        },
      });
    }

    const walletIds = uniq(latestRows.map((row) => row.wallet_id));
    const walletMetaById = await fetchWalletMeta(walletIds);

    return res.status(200).json({
      found: true,
      ...buildResponse({
        route,
        rows: latestRows,
        walletMetaById,
      }),
    });
  } catch (error) {
    console.error("[asset-viewer] unexpected error", error);

    return res.status(500).json({
      error: "Unexpected server error",
      details: error?.message || "Unknown error",
    });
  }
};