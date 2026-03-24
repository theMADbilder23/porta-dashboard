import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Get latest snapshot per wallet
    const { data: snapshots, error: snapError } = await supabase
      .from("wallet_snapshots")
      .select("*")
      .order("snapshot_time", { ascending: false });

    if (snapError) throw snapError;

    // Get holdings
    const { data: holdings, error: holdError } = await supabase
      .from("wallet_holdings")
      .select("*");

    if (holdError) throw holdError;

    // === Aggregate ===

    let totalValue = 0;
    let stableValue = 0;
    let yieldValue = 0;

    for (const h of holdings) {
      totalValue += Number(h.value_usd || 0);

      if (h.token_symbol === "USDC") {
        stableValue += Number(h.value_usd || 0);
      }

      if (h.is_yield_position) {
        yieldValue += Number(h.value_usd || 0);
      }
    }

    const growthValue = totalValue - stableValue - yieldValue;

    res.status(200).json({
      total_portfolio_value: totalValue,
      stable_value: stableValue,
      yield_value: yieldValue,
      growth_value: growthValue,
      realized_gains: null,
      realized_losses: null,
      passive_income: yieldValue
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}