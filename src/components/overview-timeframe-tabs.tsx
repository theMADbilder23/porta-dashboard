"use client";

import { useAtom } from "jotai";
import { overviewTimeframeAtom, OverviewTimeframe } from "@/lib/atoms/overview";

const tabs: OverviewTimeframe[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

export default function OverviewTimeframeTabs() {
  const [active, setActive] = useAtom(overviewTimeframeAtom);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-1">
      {tabs.map((tab) => {
        const isActive = active === tab;

        return (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-3 py-1.5 text-sm rounded-md transition-all
              ${
                isActive
                  ? "bg-[#7C3AED] text-white shadow-md"
                  : "text-muted-foreground hover:text-white hover:bg-[#7C3AED]/40"
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        );
      })}
    </div>
  );
}