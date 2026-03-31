export async function collectVictoriaVrProtocol(wallet, context = {}) {
  const walletAddress =
    wallet?.wallet_address || wallet?.address || wallet?.walletAddress || null;

  console.log("[victoria-vr] Adapter temporarily disabled", {
    wallet: walletAddress,
    reason: "Prevent inflated zero-amount protocol rows until real parsing is implemented",
  });

  return [];
}