const QUBIC_RPC_BASE = "https://rpc.qubic.org/live/v1";

/**
 * Fetch assets owned by a Qubic identity
 */
export async function getQubicOwnedAssets(identity) {
  try {
    const res = await fetch(`${QUBIC_RPC_BASE}/assets/${identity}/owned`);

    if (!res.ok) {
      throw new Error(`Qubic owned assets fetch failed: ${res.status}`);
    }

    const data = await res.json();
    const ownedAssets = Array.isArray(data?.ownedAssets) ? data.ownedAssets : [];

    return ownedAssets.map((item) => {
      const assetData = item?.data || {};
      const issuedAsset = assetData?.issuedAsset || {};

      return {
        owner_identity: assetData?.ownerIdentity || identity,
        issuance_index: assetData?.issuanceIndex ?? null,
        managing_contract_index: assetData?.managingContractIndex ?? null,
        raw_units: Number(assetData?.numberOfUnits || 0),
        asset_name: issuedAsset?.name || null,
        issuer_identity: issuedAsset?.issuerIdentity || null,
        decimal_places: Number(issuedAsset?.numberOfDecimalPlaces || 0),
        unit_of_measurement: Array.isArray(issuedAsset?.unitOfMeasurement)
          ? issuedAsset.unitOfMeasurement
          : [],
        tick: item?.info?.tick ?? null,
        universe_index: item?.info?.universeIndex ?? null,
      };
    });
  } catch (err) {
    console.error("[qubic] getQubicOwnedAssets error:", err);
    return [];
  }
}

/**
 * Find a specific owned asset by name
 */
export function findOwnedAssetByName(assets = [], targetName = "") {
  const normalizedTarget = String(targetName || "").trim().toLowerCase();

  return (
    assets.find(
      (asset) => String(asset?.asset_name || "").trim().toLowerCase() === normalizedTarget
    ) || null
  );
}