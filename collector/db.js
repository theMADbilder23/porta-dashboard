import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} from "./config.js";

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

export async function fetchWallets() {
  const { data, error } = await supabase
    .from("Wallets")
    .select("id, name, role, wallet_address, network_group, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch Wallets: ${error.message}`);
  }

  return data || [];
}

export async function insertSnapshot(payload) {
  const { data, error } = await supabase
    .from("wallet_snapshots")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Snapshot insert failed: ${error.message}`);
  }

  return data;
}

export async function insertHoldings(rows) {
  if (!rows.length) return;

  const { error } = await supabase
    .from("wallet_holdings")
    .insert(rows);

  if (error) {
    throw new Error(`Holdings insert failed: ${error.message}`);
  }
}