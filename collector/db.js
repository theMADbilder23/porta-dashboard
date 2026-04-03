import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function toIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function getUtcDayStartIso(value) {
  const date = toIsoDate(value);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  ).toISOString();
}

export async function fetchWallets() {
  const { data, error } = await supabase
    .from("Wallets")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function insertSnapshot(snapshotPayload) {
  const { data, error } = await supabase
    .from("wallet_snapshots")
    .insert(snapshotPayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertHoldings(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("wallet_holdings")
    .insert(rows)
    .select("id");

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function getLatestHoldingForWalletSymbol(walletId, tokenSymbol) {
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
    .eq("wallet_id", walletId)
    .eq("token_symbol", tokenSymbol)
    .order("snapshot_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function fetchWalletDaySnapshotsWithHoldings(walletId, snapshotTime) {
  const dayStartIso = getUtcDayStartIso(snapshotTime);

  const { data: snapshots, error: snapshotsError } = await supabase
    .from("wallet_snapshots")
    .select(
      `
      id,
      wallet_id,
      snapshot_time,
      total_claimable_usd,
      total_pending_usd,
      total_rewards_usd,
      rewards_token_symbol
      `
    )
    .eq("wallet_id", walletId)
    .gte("snapshot_time", dayStartIso)
    .lt("snapshot_time", snapshotTime)
    .order("snapshot_time", { ascending: true });

  if (snapshotsError) {
    throw snapshotsError;
  }

  const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];

  if (safeSnapshots.length === 0) {
    return [];
  }

  const snapshotIds = safeSnapshots.map((snapshot) => snapshot.id);

  const { data: holdings, error: holdingsError } = await supabase
    .from("wallet_holdings")
    .select(
      `
      snapshot_id,
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
      snapshot_time
      `
    )
    .in("snapshot_id", snapshotIds);

  if (holdingsError) {
    throw holdingsError;
  }

  const safeHoldings = Array.isArray(holdings) ? holdings : [];
  const holdingsBySnapshotId = new Map();

  for (const holding of safeHoldings) {
    const snapshotId = holding.snapshot_id;
    if (!snapshotId) continue;

    if (!holdingsBySnapshotId.has(snapshotId)) {
      holdingsBySnapshotId.set(snapshotId, []);
    }

    holdingsBySnapshotId.get(snapshotId).push(holding);
  }

  return safeSnapshots.map((snapshot) => ({
    ...snapshot,
    holdings: holdingsBySnapshotId.get(snapshot.id) || [],
  }));
}