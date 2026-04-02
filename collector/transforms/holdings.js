export function enrichHolding(holding) {
  const {
    token_symbol,
    token_name,
    network,
    amount,
    value_usd,
    category,
    protocol,
    is_yield_position,
  } = holding;

  const safeAmount = Number(amount || 0);
  const safeValue = Number(value_usd || 0);

  const price_per_unit_usd =
    safeAmount > 0 ? safeValue / safeAmount : 0;

  // -----------------------------
  // DEFAULT BASE STRUCTURE
  // -----------------------------
  let enriched = {
    ...holding,
    asset_id: `${network || "unknown"}:${token_symbol}`,
    asset_class: "crypto",
    yield_profile: "none",
    mmii_bucket: "growth",
    mmii_subclass: "realfi10",
    price_source: "debank_token",
    price_per_unit_usd,
    position_role: "principal",
  };

  const symbol = String(token_symbol || "").toUpperCase();

  // -----------------------------
  // QCAP (DIVIDEND ASSET)
  // -----------------------------
  if (symbol === "QCAP") {
    enriched.yield_profile = "dividends";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role = "principal";
    return enriched;
  }

  // -----------------------------
  // QUBIC
  // -----------------------------
  if (symbol === "QCAP") {
    enriched.is_yield_position = true;
    enriched.yield_profile = "dividends";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role = "principal";
    enriched.price_source = "manual_price";
    return enriched;
  }

  // -----------------------------
  // WELL
  // -----------------------------
  if (symbol === "WELL") {
    enriched.mmii_subclass = "realfi10";
    enriched.yield_profile = category === "reward" ? "staking" : "none";
    enriched.position_role = category === "reward" ? "reward" : "principal";
    return enriched;
  }

  // -----------------------------
  // stkWELL
  // -----------------------------
  if (symbol === "STKWELL") {
    enriched.yield_profile = "staking";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role = "principal";
    return enriched;
  }

  // -----------------------------
  // MAMO (principal + rewards)
  // -----------------------------
  if (symbol === "MAMO") {
    enriched.yield_profile = "staking";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role =
      category === "reward" ? "reward" : "principal";
    return enriched;
  }

  // -----------------------------
  // cbBTC (reward from MAMO)
  // -----------------------------
  if (symbol === "CBBTC") {
    enriched.yield_profile = "staking";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role = "reward";
    enriched.price_source = "contract_read";
    return enriched;
  }

  // -----------------------------
  // STABLECOINS
  // -----------------------------
  if (["USDC", "USDT", "USDM"].includes(symbol)) {
    enriched.asset_class = "stablecoin";
    enriched.yield_profile = is_yield_position ? "lending" : "none";
    enriched.mmii_bucket = "stable_core";
    enriched.mmii_subclass = is_yield_position
      ? "stable_collateralized"
      : "stable_non_collateralized";
    enriched.position_role =
      category === "reward" ? "reward" : "principal";
    return enriched;
  }

  // -----------------------------
  // GENERIC REWARD FALLBACK
  // -----------------------------
  if (category === "reward") {
    enriched.position_role = "reward";
    enriched.yield_profile = "staking";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.price_source = "merkl_rewards";
    return enriched;
  }

  return enriched;
}