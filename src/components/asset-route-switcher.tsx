"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type AssetRouteOption = {
  route_param: string;
  token_symbol: string;
  token_name: string;
  network: string;
  price_per_unit_usd?: number | null;
  total_value_usd?: number | null;
};

type AssetRouteSwitcherProps = {
  currentRoute: string;
  options: AssetRouteOption[];
  placeholder?: string;
};

function normalizeText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function formatCurrency(value?: number | null) {
  const safeValue = Number(value || 0);

  if (!Number.isFinite(safeValue)) return "—";

  if (safeValue >= 1_000_000_000) {
    return `$${(safeValue / 1_000_000_000).toFixed(2)}B`;
  }

  if (safeValue >= 1_000_000) {
    return `$${(safeValue / 1_000_000).toFixed(2)}M`;
  }

  if (safeValue >= 1_000) {
    return `$${(safeValue / 1_000).toFixed(2)}K`;
  }

  return `$${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AssetRouteSwitcher({
  currentRoute,
  options,
  placeholder = "Search asset by symbol, name, or network...",
}: AssetRouteSwitcherProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const currentOption = useMemo(() => {
    const normalizedCurrent = normalizeText(currentRoute);
    return (
      options.find(
        (option) => normalizeText(option.route_param) === normalizedCurrent
      ) || null
    );
  }, [currentRoute, options]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    const base = normalizedQuery
      ? options.filter((option) => {
          const haystack = [
            option.token_symbol,
            option.token_name,
            option.network,
            option.route_param,
          ]
            .map((value) => normalizeText(value))
            .join(" ");

          return haystack.includes(normalizedQuery);
        })
      : options;

    return base.slice(0, 12);
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSelect(routeParam: string) {
    if (!routeParam) return;
    setQuery("");
    setOpen(false);
    router.push(`/portfolio/assets/${encodeURIComponent(routeParam)}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-3 shadow-sm dark:border-[#312047] dark:bg-[#140D20]">
        <div className="flex flex-col gap-3 laptop:flex-row laptop:items-center">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
              Asset Search
            </p>

            <div className="flex items-center gap-2 rounded-xl border border-[#E9DAFF] bg-white px-3 py-2.5 dark:border-[#312047] dark:bg-[#100A19]">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4 shrink-0 text-[#8B5CF6] dark:text-[#C084FC]"
                fill="none"
              >
                <path
                  d="M14.1667 14.1667L17.5 17.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle
                  cx="8.75"
                  cy="8.75"
                  r="5.91667"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>

              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-[#2D1B45] outline-none placeholder:text-[#8E7AB5] dark:text-[#F3E8FF] dark:placeholder:text-[#9E8BC5]"
              />
            </div>
          </div>

          <div className="min-w-[220px] rounded-xl border border-[#EEE4FF] bg-white px-3 py-2.5 dark:border-[#312047] dark:bg-[#100A19]">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
              Current
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
              {currentOption?.route_param || currentRoute}
            </p>
          </div>
        </div>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[#E9DAFF] bg-white shadow-xl dark:border-[#312047] dark:bg-[#100A19]">
          <div className="max-h-[360px] overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isCurrent =
                  normalizeText(option.route_param) ===
                  normalizeText(currentRoute);

                return (
                  <button
                    key={option.route_param}
                    type="button"
                    onClick={() => handleSelect(option.route_param)}
                    className={`flex w-full items-start justify-between gap-4 rounded-xl px-3 py-3 text-left transition-colors ${
                      isCurrent
                        ? "bg-[#F3E8FF] dark:bg-[#1A1226]"
                        : "hover:bg-[#F8F4FF] dark:hover:bg-[#140D20]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                          {option.token_symbol}
                        </span>
                        <span className="rounded-full border border-[#E9DAFF] bg-[#FCFAFF] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#6D28D9] dark:border-[#312047] dark:bg-[#140D20] dark:text-[#D8B4FE]">
                          {option.network}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full border border-[#DDEBFF] bg-[#F5F9FF] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#2563EB] dark:border-[#1D2B47] dark:bg-[#101827] dark:text-[#93C5FD]">
                            Current
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 truncate text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
                        {option.token_name || option.route_param}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-[#8E7AB5] dark:text-[#9E8BC5]">
                        {option.route_param}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCurrency(option.total_value_usd)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#6B5A86] dark:text-[#BFA9F5]">
                        {option.price_per_unit_usd
                          ? `Px ${formatCurrency(option.price_per_unit_usd)}`
                          : "Live asset"}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl px-3 py-4 text-sm text-[#6B5A86] dark:text-[#BFA9F5]">
                No matching assets found.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}