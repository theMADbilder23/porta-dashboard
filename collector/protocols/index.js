import { collectMamoProtocol } from "./mamo.js";
import { collectVictoriaVrProtocol } from "./victoria-vr.js";

export async function collectCustomProtocols(wallet, context = {}) {
  const [mamoHoldings, victoriaVrHoldings] = await Promise.all([
    collectMamoProtocol(wallet, context),
    collectVictoriaVrProtocol(wallet, context),
  ]);

  return [
    ...(Array.isArray(mamoHoldings) ? mamoHoldings : []),
    ...(Array.isArray(victoriaVrHoldings) ? victoriaVrHoldings : []),
  ];
}