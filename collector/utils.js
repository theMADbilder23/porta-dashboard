export function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function cleanWallet(wallet) {
  return String(wallet || "")
    .trim()
    .replace(/</g, "")
    .replace(/>/g, "");
}

export function isValidWallet(wallet) {
  return wallet.startsWith("0x") && wallet.length === 42;
}