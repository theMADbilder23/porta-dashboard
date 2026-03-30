import { safeNumber } from "../utils.js";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isVictoriaVrHolding(holding) {
  const symbol = normalizeText(holding?.token_symbol);
  const protocol = normalizeText(holding?.protocol);
  const tokenName = normalizeText(holding?.token_name);

  return (
    symbol === "vvr" ||
    protocol.includes("victoria") ||
    protocol.includes("victoria vr") ||
    tokenName.includes("victoria") ||
    tokenName.includes("victoria vr")
  );
}

function buildNormalizedVictoriaVrHolding(holding, snapshotTime) {
  return {
    token_symbol: holding.token_symbol || "VVR",
    token_name: holding.token_name || "Victoria VR",
    network: holding.network || "eth",
    amount: safeNumber(holding.amount || 0),
    value_usd: safeNumber(holding.value_usd || 0),
    category: "protocol",
    protocol: "Victoria VR",
    is_yield_position: true,
    snapshot_time: snapshotTime,
    metadata: {
      source: "debank-seeded",
    },
  };
}

export async function collectVictoriaVrProtocol(wallet, context = {}) {
  const snapshotTime = context.snapshotTime;
  const debankData = context.debankData || {};
  const allTokens = Array.isArray(debankData.allTokens) ? debankData.allTokens : [];
  const allProtocols = Array.isArray(debankData.allProtocols) ? debankData.allProtocols : [];

  const normalized = [];

  for (const token of allTokens) {
    const symbol = token?.optimized_symbol || token?.symbol || "";
    const tokenName = token?.name || symbol || "Unknown";
    const amount = safeNumber(token?.amount || 0);
    const price = safeNumber(token?.price || 0);
    const value = safeNumber(token?.usd_value ?? price * amount ?? 0);

    const holding = {
      token_symbol: symbol,
      token_name: tokenName,
      network: token?.chain || "eth",
      amount,
      value_usd: value,
      category: "wallet",
      protocol: null,
      is_yield_position: false,
    };

    if (isVictoriaVrHolding(holding)) {
      normalized.push(buildNormalizedVictoriaVrHolding(holding, snapshotTime));
    }
  }

  for (const protocol of allProtocols) {
    const protocolName = protocol?.name || "Unknown";
    const protocolNetwork = protocol?.chain || "eth";

    let totalValue = 0;
    let totalAmount = 0;
    let amountSymbol = "VVR";
    let amountTokenName = "Victoria VR";

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

          if (symbol && normalizeText(symbol) === "vvr") {
            amountSymbol = symbol;
            amountTokenName = symbol;
            totalAmount += amount;
          }
        }
      }
    }

    const candidate = {
      token_symbol: amountSymbol,
      token_name: amountTokenName,
      network: protocolNetwork,
      amount: totalAmount,
      value_usd: totalValue,
      category: "protocol",
      protocol: protocolName,
      is_yield_position: true,
    };

    if (isVictoriaVrHolding(candidate) && candidate.value_usd > 0) {
      normalized.push(buildNormalizedVictoriaVrHolding(candidate, snapshotTime));
    }
  }

  const deduped = new Map();

  for (const holding of normalized) {
    const key = [
      holding.token_symbol,
      holding.protocol,
      holding.network,
      Math.round(safeNumber(holding.value_usd) * 100),
    ].join("::");

    if (!deduped.has(key)) {
      deduped.set(key, holding);
    }
  }

  return Array.from(deduped.values());
}