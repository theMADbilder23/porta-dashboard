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

function buildRouteParam(row) {
  const network = normalizeText(row.network || "unknown");
  const symbol = normalizeText(row.token_symbol || row.token_name || "asset");
  return `${network}:${symbol}`;
}

function pickPreferredRow(existing, next) {
  if (!existing) return next;

  const valueDiff = safeNumber(next.total_value_usd) - safeNumber(existing.total_value_usd);
  if (valueDiff !== 0) return valueDiff > 0 ? next : existing;

  const snapshotDiff =
    new Date(next.snapshot_time || 0).getTime() -
    new Date(existing.snapshot_time || 0).getTime();

  if (snapshotDiff !== 0) return snapshotDiff > 0 ? next : existing;

  return existing;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabase
      .from("wallet_holdings")
      .select(
        `
        token_symbol,
        token_name,
        network,
        asset_id,
        price_per_unit_usd,
        value_usd,
        snapshot_time
        `
      )
      .order("snapshot_time", { ascending: false })
      .limit(2500);

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    const byRoute = new Map();

    for (const row of rows) {
      const tokenSymbol = normalizeText(row.token_symbol);
      const network = normalizeText(row.network);

      if (!tokenSymbol || !network) continue;

      const routeParam = buildRouteParam(row);
      const key = normalizeLower(routeParam);

      const normalizedRow = {
        route_param: routeParam,
        token_symbol: tokenSymbol,
        token_name: normalizeText(row.token_name || tokenSymbol),
        network,
        asset_id: normalizeText(row.asset_id || routeParam),
        price_per_unit_usd: safeNumber(row.price_per_unit_usd),
        total_value_usd: safeNumber(row.value_usd),
        snapshot_time: row.snapshot_time || null,
      };

      const existing = byRoute.get(key);
      byRoute.set(key, pickPreferredRow(existing, normalizedRow));
    }

    const routes = Array.from(byRoute.values()).sort((a, b) => {
      const valueDiff = safeNumber(b.total_value_usd) - safeNumber(a.total_value_usd);
      if (valueDiff !== 0) return valueDiff;

      return a.token_symbol.localeCompare(b.token_symbol);
    });

    return res.status(200).json({
      routes,
      count: routes.length,
      resolver: "wallet_holdings_distinct_routes",
    });
  } catch (error) {
    console.error("[asset-routes] unexpected error", error);

    return res.status(500).json({
      error: "Unexpected server error",
      details: error?.message || "Unknown error",
    });
  }
};