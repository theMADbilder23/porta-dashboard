"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AssetRouteSwitcherProps = {
  currentRoute: string;
  placeholder?: string;
};

function normalizeAssetRoute(value: string) {
  return String(value || "").trim();
}

export default function AssetRouteSwitcher({
  currentRoute,
  placeholder = "Search / switch asset (example: base:stkWELL)",
}: AssetRouteSwitcherProps) {
  const router = useRouter();
  const [value, setValue] = useState(currentRoute);
  const [error, setError] = useState("");

  const currentLabel = useMemo(() => normalizeAssetRoute(currentRoute), [currentRoute]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextRoute = normalizeAssetRoute(value);

    if (!nextRoute) {
      setError("Enter an asset route to switch.");
      return;
    }

    setError("");
    router.push(`/portfolio/assets/${encodeURIComponent(nextRoute)}`);
  }

  return (
    <div className="rounded-2xl border border-[#E9DAFF] bg-[#FCFAFF] p-4 shadow-sm dark:border-[#2A1D3B] dark:bg-[#140D20]">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
        Asset Search / Switcher
      </p>

      <p className="mt-2 text-sm leading-6 text-[#6B5A86] dark:text-[#BFA9F5]">
        Seamlessly jump to another asset viewer page without going back to the
        accounts screens.
      </p>

      <div className="mt-3 rounded-xl border border-[#EEE4FF] bg-white px-4 py-3 text-sm text-[#2D1B45] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#F3E8FF]">
        <span className="font-medium">Current:</span> {currentLabel}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B5CF6] dark:text-[#C084FC]">
            Asset Route
          </span>

          <div className="flex flex-col gap-3 laptop:flex-row">
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-[#E9DAFF] bg-white px-4 py-3 text-sm text-[#2D1B45] outline-none transition focus:border-[#7C3AED] dark:border-[#312047] dark:bg-[#100A19] dark:text-[#F3E8FF]"
            />

            <button
              type="submit"
              className="rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#6D28D9]"
            >
              Switch Asset
            </button>
          </div>
        </label>

        {error ? (
          <p className="text-sm text-[#B45309] dark:text-[#FCD34D]">{error}</p>
        ) : (
          <p className="text-xs leading-5 text-[#6B5A86] dark:text-[#BFA9F5]">
            Use Porta’s asset route format, like <span className="font-medium">base:stkWELL</span> or{" "}
            <span className="font-medium">qubic:QCAP</span>.
          </p>
        )}
      </form>
    </div>
  );
}