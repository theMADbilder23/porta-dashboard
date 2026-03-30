import { safeNumber } from "../utils.js";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function dedupeHoldings(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      row.token_symbol || "",
      row.token_name || "",
      row.network || "",
      row.protocol || "",
      row.category || "",
      Math.round(safeNumber(row.amount) * 1e6),
      Math.round(safeNumber(row.value_usd) * 100),
    ].join("::");

    if (!map.has(key)) {
      map.set(key, row);
    }
  }

  return Array.from(map.values());
}

function extractMamoFromDebank(context = {}) {
  const snapshotTime = context.snapshotTime || new Date().toISOString();
  const debankData = context.debankData || {};
  const allTokens = Array.isArray(debankData.allTokens) ? debankData.allTokens : [];
  const allProtocols = Array.isArray(debankData.allProtocols) ? debankData.allProtocols : [];

  const rows = [];

  for (const token of allTokens) {
    const symbol = token?.optimized_symbol || token?.symbol || "";
    const tokenName = token?.name || symbol || "Unknown";
    const amount = safeNumber(token?.amount || 0);
    const price = safeNumber(token?.price || 0);
    const value = safeNumber(token?.usd_value ?? price * amount ?? 0);

    if (
      normalizeText(symbol) === "mamo" ||
      normalizeText(tokenName).includes("mamo")
    ) {
      rows.push({
        token_symbol: symbol || "MAMO",
        token_name: tokenName || "MAMO",
        network: token?.chain || "base",
        amount,
        value_usd: value,
        category: "protocol",
        protocol: "Mamo",
        is_yield_position: true,
        snapshot_time: snapshotTime,
      });
    }
  }

  for (const protocol of allProtocols) {
    const protocolName = protocol?.name || "Unknown";
    const protocolNetwork = protocol?.chain || "base";

    let totalValue = 0;
    let totalAmount = 0;
    let amountSymbol = "MAMO";
    let amountTokenName = "MAMO";

    for (const item of protocol?.portfolio_item_list || []) {
      const stats = item?.stats || {};
      const itemValue = safeNumber(
        stats?.net_usd_value ?? stats?.asset_usd_value ?? 0
      );
      totalValue += itemValue;

      const detailTypes = [
        "supply_token_list",
        "borrow_token_list",
        "reward_token_list",
        "deposit_token_list",
        "stake_token_list",
        "lock_token_list",
      ];

      for (const detailType of detailTypes) {
        const detailList = item?.detail?.[detailType] || [];

        for (const token of detailList) {
          const symbol = token?.optimized_symbol || token?.symbol || null;
          const amount = safeNumber(token?.amount || 0);

          if (symbol && normalizeText(symbol) === "mamo") {
            amountSymbol = symbol;
            amountTokenName = token?.name || symbol;
            totalAmount += amount;
          }
        }
      }
    }

    if (
      totalValue > 0 &&
      (
        normalizeText(amountSymbol) === "mamo" ||
        normalizeText(amountTokenName).includes("mamo") ||
        normalizeText(protocolName).includes("mamo")
      )
    ) {
      rows.push({
        token_symbol: amountSymbol,
        token_name: amountTokenName,
        network: protocolNetwork,
        amount: totalAmount,
        value_usd: totalValue,
        category: "protocol",
        protocol: "Mamo",
        is_yield_position: true,
        snapshot_time: snapshotTime,
      });
    }
  }

  return dedupeHoldings(rows);
}

export async function collectMamoProtocol(wallet, context = {}) {
  const walletAddress =
    wallet?.wallet_address || wallet?.address || wallet?.walletAddress || null;

  const rows = extractMamoFromDebank(context);

  console.log("[mamo] DeBank extraction result", {
    wallet: walletAddress,
    rows_found: rows.length,
    rows,
  });

  return rows;
}