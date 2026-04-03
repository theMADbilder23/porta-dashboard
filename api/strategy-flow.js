import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 🔹 Fetch wallets
    const { data: wallets, error: walletsError } = await supabase
      .from("wallets")
      .select("*");

    if (walletsError) {
      throw walletsError;
    }

    // 🔹 Fetch latest snapshot per wallet
    const { data: snapshots, error: snapshotError } = await supabase
      .from("wallet_snapshots")
      .select("*")
      .order("snapshot_time", { ascending: false });

    if (snapshotError) {
      throw snapshotError;
    }

    // 🔹 Map latest snapshot per wallet
    const latestByWallet = new Map();

    for (const snap of snapshots) {
      if (!latestByWallet.has(snap.wallet_id)) {
        latestByWallet.set(snap.wallet_id, snap);
      }
    }

    // 🔹 Build response structure
    const nodes = wallets.map((wallet) => {
      const snap = latestByWallet.get(wallet.id);

      return {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type || "wallet",
        role: wallet.role || "unassigned",
        total_value_usd: snap?.total_value_usd || 0,
        total_claimable_usd: snap?.total_claimable_usd || 0,
      };
    });

    return res.status(200).json({
      success: true,
      nodes,
    });
  } catch (err) {
    console.error("❌ Strategy Flow API Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}