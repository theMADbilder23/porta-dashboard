export function enrichHolding(holding) {
  const {
    token_symbol,
    network,
    amount,
    value_usd,
    category,
    protocol,
    is_yield_position,
  } = holding;

  const safeAmount = Number(amount || 0);
  const safeValue = Number(value_usd || 0);
  const suppliedUnitPrice = Number(holding?.price_per_unit_usd || 0);

  const price_per_unit_usd =
    suppliedUnitPrice > 0
      ? suppliedUnitPrice
      : safeAmount > 0
        ? safeValue / safeAmount
        : 0;

  const symbol = String(token_symbol || "").toUpperCase();
  const normalizedCategory = String(category || "").toLowerCase();
  const normalizedProtocol = String(protocol || "").toLowerCase();
  const normalizedNetwork = String(network || "").toLowerCase();

  const enriched = {
    ...holding,
    asset_id: holding?.asset_id || `${network || "unknown"}:${token_symbol}`,
    asset_class: holding?.asset_class || "crypto",
    yield_profile: holding?.yield_profile || "none",
    mmii_bucket: holding?.mmii_bucket || "growth",
    mmii_subclass: holding?.mmii_subclass || "realfi10",
    price_source: holding?.price_source || "debank_token",
    price_per_unit_usd,
    position_role: holding?.position_role || "principal",
  };

  if (symbol === "QCAP") {
    enriched.is_yield_position = true;
    enriched.yield_profile = "dividends";
    enriched.mmii_bucket = "growth";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role = "principal";
    enriched.price_source = "manual_price";
    return enriched;
  }

  if (symbol === "QUBIC") {
    enriched.is_yield_position = false;
    enriched.yield_profile = "none";
    enriched.mmii_bucket = "growth";
    enriched.mmii_subclass = "realfi10";
    enriched.position_role = "principal";
    enriched.price_source = "manual_price";
    return enriched;
  }

  if (symbol === "WELL") {
    enriched.mmii_bucket = "growth";
    enriched.mmii_subclass = "realfi10";
    enriched.yield_profile =
      normalizedCategory === "reward" ? "staking" : "none";
    enriched.position_role =
      normalizedCategory === "reward" ? "reward" : "principal";
    enriched.price_source =
      normalizedCategory === "reward" ? "merkl_rewards" : "debank_token";
    return enriched;
  }

  if (symbol === "STKWELL") {
    enriched.is_yield_position = true;
    enriched.yield_profile = "staking";
    enriched.mmii_bucket = "growth";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role = "principal";
    enriched.price_source = "debank_token";
    return enriched;
  }

  if (symbol === "MAMO") {
    enriched.yield_profile = "staking";
    enriched.mmii_bucket = "growth";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role =
      normalizedCategory === "reward" ? "reward" : "principal";

    if (normalizedProtocol === "mamo") {
      enriched.price_source = "contract_read";
    }

    return enriched;
  }

  if (symbol === "CBBTC") {
    enriched.yield_profile = "staking";
    enriched.mmii_bucket = "growth";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.position_role = "reward";
    enriched.price_source = "contract_read";
    return enriched;
  }

  if (["USDC", "USDT", "USDM"].includes(symbol)) {
    enriched.asset_class = "stablecoin";
    enriched.yield_profile = is_yield_position ? "lending" : "none";
    enriched.mmii_bucket = "stable_core";
    enriched.mmii_subclass = is_yield_position
      ? "stable_collateralized"
      : "stable_non_collateralized";
    enriched.position_role =
      normalizedCategory === "reward" ? "reward" : "principal";
    enriched.price_source = "debank_token";
    return enriched;
  }

  if (normalizedCategory === "reward") {
    enriched.position_role = "reward";
    enriched.yield_profile = "staking";
    enriched.mmii_bucket = "growth";
    enriched.mmii_subclass = "defi_growth_yield";
    enriched.price_source =
      normalizedProtocol === "mamo" ? "contract_read" : "merkl_rewards";
    return enriched;
  }

  if (normalizedNetwork === "qubic") {
    enriched.price_source = "manual_price";
    return enriched;
  }

  return enriched;
}