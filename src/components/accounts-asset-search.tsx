"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";

type AssetRouteItem = {
  route_param: string;
  token_symbol: string;
  token_name: string;
  network: string;
  price_per_unit_usd?: number;
  total_value_usd?: number;
};

function formatCompactUsd(value?: number) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safeValue);
}

export default function AccountsAssetSearch({
  routes,
}: {
  routes: AssetRouteItem[];
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredRoutes = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return routes.slice(0, 6);
    }

    return routes
      .filter((route) => {
        const haystack = [
          route.token_symbol,
          route.token_name,
          route.network,
          route.route_param,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalized);
      })
      .slice(0, 8);
  }, [routes, query]);

  const selectedRoute =
    filteredRoutes.length > 0
      ? filteredRoutes[Math.min(activeIndex, filteredRoutes.length - 1)]
      : null;

  function openRoute(routeParam: string) {
    setIsOpen(false);
    router.push(`/portfolio/assets/${encodeURIComponent(routeParam)}`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (selectedRoute) {
      openRoute(selectedRoute.route_param);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!filteredRoutes.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) =>
        prev >= filteredRoutes.length - 1 ? 0 : prev + 1
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) =>
        prev <= 0 ? filteredRoutes.length - 1 : prev - 1
      );
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedRoute) {
        openRoute(selectedRoute.route_param);
      }
    }

    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-3 dark:border-[#241733] dark:bg-[#120D1B]">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E7AAE] dark:text-[#9F89BA]" />

            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search portfolio assets..."
              className="h-12 w-full rounded-xl border border-[#E9DAFF] bg-white pl-11 pr-4 text-sm text-[#2D1B45] outline-none transition placeholder:text-[#9A88B6] focus:border-[#CDAEFF] dark:border-[#2C1C3F] dark:bg-[#0E0916] dark:text-[#F3E8FF] dark:placeholder:text-[#8F7AA7] dark:focus:border-[#5C3692]"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-[#7A3FFF] px-5 text-sm font-medium text-white transition hover:bg-[#6B33EB]"
          >
            Open Asset Viewer
          </button>
        </form>

        <div className="mt-3 text-xs text-[#8E7AAE] dark:text-[#9F89BA]">
          Live route list sourced from the Asset Viewer route resolver.
        </div>
      </div>

      {isOpen && filteredRoutes.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-2xl border border-[#E9DAFF] bg-white shadow-[0_18px_50px_rgba(82,36,138,0.14)] dark:border-[#241733] dark:bg-[#100A19] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <div className="max-h-[360px] overflow-y-auto p-2">
            {filteredRoutes.map((route, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={route.route_param}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => openRoute(route.route_param)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                    isActive
                      ? "bg-[#F4ECFF] dark:bg-[#1A1227]"
                      : "hover:bg-[#F8F3FF] dark:hover:bg-[#151020]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        {route.token_symbol}
                      </span>

                      <span className="rounded-full border border-[#E9DAFF] bg-[#FAF7FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7A3FFF] dark:border-[#312046] dark:bg-[#140F1F] dark:text-[#CDAEFF]">
                        {route.network}
                      </span>

                      {isActive ? (
                        <span className="rounded-full border border-[#D9E7FF] bg-[#F3F8FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3D6FE0] dark:border-[#23395F] dark:bg-[#101827] dark:text-[#8FB3FF]">
                          Current
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 truncate text-sm text-[#6B5A86] dark:text-[#BFA9D5]">
                      {route.token_name}
                    </div>

                    <div className="mt-0.5 truncate text-xs text-[#8E7AAE] dark:text-[#9F89BA]">
                      {route.route_param}
                    </div>
                  </div>

                  <div className="ml-4 flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                        {formatCompactUsd(route.total_value_usd)}
                      </div>

                      <div className="text-xs text-[#8E7AAE] dark:text-[#9F89BA]">
                        Px{" "}
                        {route.price_per_unit_usd
                          ? formatCompactUsd(route.price_per_unit_usd)
                          : "$0"}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-[#9A88B6] dark:text-[#8F7AA7]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}