import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { timeframe = "daily" } = req.query;

  try {
    const { data, error } = await supabase
      .from("wallet_snapshots")
      .select("snapshot_time, total_value_usd, total_claimable_usd")
      .order("snapshot_time", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(200).json([]);
    }

    // 🧠 Group based on timeframe
    let grouped = [];

    if (timeframe === "daily") {
      grouped = data.slice(-7); // last 7 points
    } else if (timeframe === "weekly") {
      grouped = data.filter((_, i) => i % 7 === 0);
    } else if (timeframe === "monthly") {
      grouped = data.filter((_, i) => i % 30 === 0);
    } else if (timeframe === "quarterly") {
      grouped = data.filter((_, i) => i % 90 === 0);
    } else {
      grouped = data.filter((_, i) => i % 180 === 0);
    }

    return res.status(200).json(grouped);
  } catch (err) {
    console.error("Performance API error:", err);
    return res.status(500).json({ error: "Failed to load performance data" });
  }
}