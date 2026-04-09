"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

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
  const [query, setQuery] = useState("");

  const filteredRoutes = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return routes.slice(0, 8);
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
    filteredRoutes.find(
      (route) =>
        route.route_param.toLowerCase() === query.trim().toLowerCase()
    ) || null;

  function openRoute(routeParam: string) {
    router.push(`/portfolio/assets/${encodeURIComponent(routeParam)}`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (selectedRoute) {
      openRoute(selectedRoute.route_param);
      return;
    }

    if (filteredRoutes.length > 0) {
      openRoute(filteredRoutes[0].route_param);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-3 dark:border-[#241733] dark:bg-[#120D1B]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E7AAE] dark:text-[#9F89BA]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search portfolio assets..."
            className="h-12 w-full rounded-xl border border-[#E9DAFF] bg-white pl-11 pr-4 text-sm text-[#2D1B45] outline-none transition placeholder:text-[#9A88B6] focus:border-[#CDAEFF] dark:border-[#2C1C3F] dark:bg-[#0E0916] dark:text-[#F3E8FF] dark:placeholder:text-[#8F7AA7] dark:focus:border-[#5C3692]"
          />
        </div>

        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#7A3FFF] px-5 text-sm font-medium text-white transition hover:bg-[#6B33EB]"
        >
          Open Asset Viewer
        </button>
      </form>

      <div className="mt-3 rounded-2xl border border-[#F0E7FF] bg-white p-2 dark:border-[#241733] dark:bg-[#0E0916]">
        {filteredRoutes.length === 0 ? (
          <div className="px-3 py-3 text-sm text-[#8E7AAE] dark:text-[#9F89BA]">
            No tracked assets found.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredRoutes.map((route) => (
              <button
                key={route.route_param}
                type="button"
                onClick={() => openRoute(route.route_param)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-[#F7F1FF] dark:hover:bg-[#151020]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                    {route.token_symbol}{" "}
                    <span className="font-normal text-[#7E6B98] dark:text-[#A892C2]">
                      · {route.network}
                    </span>
                  </div>
                  <div className="truncate text-xs text-[#8E7AAE] dark:text-[#9F89BA]">
                    {route.token_name} · {route.route_param}
                  </div>
                </div>

                <div className="ml-4 shrink-0 text-right">
                  <div className="text-sm font-semibold text-[#2D1B45] dark:text-[#F3E8FF]">
                    {formatCompactUsd(route.total_value_usd)}
                  </div>
                  <div className="text-xs text-[#8E7AAE] dark:text-[#9F89BA]">
                    {route.price_per_unit_usd
                      ? formatCompactUsd(route.price_per_unit_usd)
                      : "No price"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-[#8E7AAE] dark:text-[#9F89BA]">
        Live route list sourced from the Asset Viewer route resolver.
      </div>
    </div>
  );
}