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
  const content = (
    <>
      <h2
        className={cn(
          chartTitle({ color: "mute", size: "sm" }),
          "mb-2 flex items-center gap-2 text-[#6B5A86] dark:text-[#BFA9F5]"
        )}
      >
        {icon ? (
          <span className="text-[#7C3AED] dark:text-[#C084FC]">{icon}</span>
        ) : null}
        <span>{title}</span>
      </h2>

      <div className="flex items-center gap-2">
        <span className="text-[2rem] font-semibold leading-none text-[#2D1B45] dark:text-[#F3E8FF]">
          {value}
        </span>
        <ChangeIndicator change={change} />
      </div>

      <div className="mt-2 text-xs text-[#6B5A86] dark:text-[#BFA9F5]">
        {helperText}
      </div>
    </>
  );

  const baseClasses =
    "flex flex-col rounded-2xl border px-4 py-4 text-left transition-all duration-200";
  const stateClasses = active
    ? "border-[#7C3AED]/60 bg-[#F8F3FF] shadow-[0_0_0_1px_rgba(124,58,237,0.12)] dark:border-[#C084FC]/50 dark:bg-[#161022]"
    : "border-[#E9DAFF] bg-white shadow-sm hover:border-[#D7C2FF] hover:bg-[#FCFAFF] dark:border-[#2A1D3B] dark:bg-[#100A19] dark:hover:border-[#3A2752] dark:hover:bg-[#140D20]";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClasses, stateClasses, className)}
      >
        {content}
      </button>
    );
  }

  return <section className={cn(baseClasses, stateClasses, className)}>{content}</section>;
}

function ChangeIndicator({ change }: { change: number }) {
  const positive = change >= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        positive
          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {positive ? "+" : ""}
      {Math.round(change * 100)}%
      {positive ? (
        <ArrowUpRight className="ml-1 h-3 w-3" />
      ) : (
        <ArrowDownRight className="ml-1 h-3 w-3" />
      )}
    </span>
  );
}