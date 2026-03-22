"use client";

import { useAtom } from "jotai";
import { overviewTimeframeAtom, type OverviewTimeframe } from "@/lib/atoms/overview";
import { cn } from "@/lib/utils";

const options: OverviewTimeframe[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

export default function OverviewTimeframeTabs() {
  const [timeframe, setTimeframe] = useAtom(overviewTimeframeAtom);

  return (
    <div className="inline-flex items-center rounded-xl border border-[#D8C8F2] bg-white/70 p-1 backdrop-blur-md dark:border-[#241533] dark:bg-[#100A19]/80">
      {options.map((option) => {
        const active = timeframe === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => setTimeframe(option)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              active
                ? "bg-[#E6D5FF] text-[#5B21B6] dark:bg-[#221433] dark:text-[#D8B4FE]"
                : "text-[#6B4FA3] hover:bg-[#F1E8FF] dark:text-[#C4B5FD] dark:hover:bg-[#1A1226]"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}