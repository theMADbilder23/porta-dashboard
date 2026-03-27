import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { chartTitle } from "@/components/primitives";
import { cn } from "@/lib/utils";

export default function MetricCard({
  title,
  value,
  change,
  className,
  icon,
  helperText = "vs selected period",
  active = false,
  onClick,
}: {
  title: string;
  value: string;
  change: number;
  className?: string;
  icon?: ReactNode;
  helperText?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-lg border border-transparent p-2 -m-2 text-left transition-all",
        "hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5",
        active && "border-[#7C3AED]/60 bg-[#7C3AED]/10 shadow-[0_0_0_1px_rgba(124,58,237,0.25)]",
        className
      )}
    >
      <h2
        className={cn(
          chartTitle({ color: "mute", size: "sm" }),
          "mb-1 flex items-center gap-2"
        )}
      >
        {icon ? (
          <span className="text-[#7C3AED] dark:text-[#C084FC]">{icon}</span>
        ) : null}
        <span>{title}</span>
      </h2>

      <div className="flex items-center gap-2">
        <span className="text-xl font-medium">{value}</span>
        <ChangeIndicator change={change} />
      </div>

      <div className="text-xs text-muted-foreground">{helperText}</div>
    </button>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  const positive = change >= 0;

  return (
    <span
      className={cn(
        "flex items-center rounded-sm px-1 py-0.5 text-xs text-muted-foreground",
        positive
          ? "bg-green-50 text-green-500 dark:bg-green-950"
          : "bg-red-50 text-red-500 dark:bg-red-950"
      )}
    >
      {positive ? "+" : ""}
      {Math.round(change * 100)}%
      {positive ? (
        <ArrowUpRight className="ml-0.5 inline-block h-3 w-3" />
      ) : (
        <ArrowDownRight className="ml-0.5 inline-block h-3 w-3" />
      )}
    </span>
  );
}