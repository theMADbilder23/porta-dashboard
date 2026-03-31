export async function collectMamoProtocol(wallet, context = {}) {
  const walletAddress =
    wallet?.wallet_address || wallet?.address || wallet?.walletAddress || null;

  console.log("[mamo] Adapter temporarily disabled", {
    wallet: walletAddress,
    reason: "Prevent inflated protocol rows until proper contract or SDK integration is implemented",
  });

  return [];
}