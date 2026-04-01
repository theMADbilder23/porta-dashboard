const QUBIC_RPC_BASE = "https://rpc.qubic.org/live/v1";

/**
 * Fetch native QUBIC balance
 */
export async function getQubicBalance(identity) {
  try {
    const res = await fetch(`${QUBIC_RPC_BASE}/balances/${identity}`);

    if (!res.ok) {
      throw new Error(`Qubic balance fetch failed: ${res.status}`);
    }

    const data = await res.json();

    const rawBalance = Number(data?.balance?.balance || 0);

    return {
      identity,
      raw_balance: rawBalance,
    };
  } catch (err) {
    console.error("[qubic] getQubicBalance error:", err);
    return {
      identity,
      raw_balance: 0,
    };
  }
}