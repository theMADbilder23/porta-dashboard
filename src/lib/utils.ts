import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function addThousandsSeparator(num: number) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function numberToPercentage(num: number) {
  return `${num * 100}%`;
}

export function formatUsdCompact(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const absValue = Math.abs(safeValue);

  if (absValue >= 1_000_000_000_000) {
    return `$${(safeValue / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (absValue >= 1_000_000_000) {
    return `$${(safeValue / 1_000_000_000).toFixed(2)}B`;
  }

  if (absValue >= 1_000_000) {
    return `$${(safeValue / 1_000_000).toFixed(2)}M`;
  }

  if (absValue >= 1_000) {
    return `$${(safeValue / 1_000).toFixed(2)}K`;
  }

  return `$${safeValue.toFixed(2)}`;
}

export function formatUsdRounded(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return `$${Math.round(safeValue).toLocaleString()}`;
}