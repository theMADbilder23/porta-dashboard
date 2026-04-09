import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { chartTitle } from "@/components/primitives";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string;
  change: number;
  className?: string;
  icon?: ReactNode;
  helperText?: string;
  active?: boolean;
  onClick?: () => void;
  changeTooltip?: string;
};

export default function MetricCard({
  title,
  value,
  change,
  className,
  icon,
  helperText = "vs selected period",
  active = false,
  onClick,
  changeTooltip,
}: MetricCardProps) {
  const content = (
    <>
      <h2
        className={cn(
          chartTitle({ color: "mute", size: "sm" }),
          "mb-2 flex items-center gap-2 text-[#6B5A86] dark:text-[#BFA9F5]",
        )}
      >
        {icon ? (
          <span className="shrink-0 text-[#7C3AED] dark:text-[#C084FC]">
            {icon}
          </span>
        ) : null}
        <span className="truncate">{title}</span>
      </h2>

      <div className="flex items-center gap-2">
        <span className="truncate text-[1.38rem] font-semibold leading-none tracking-[-0.02em] text-[#2D1B45] dark:text-[#F3E8FF] md:text-[1.55rem]">
          {value}
        </span>
        <ChangeIndicator change={change} tooltip={changeTooltip} />
      </div>

      <div className="mt-2 text-[11px] font-medium text-[#6B5A86] dark:text-[#BFA9F5] md:text-xs">
        {helperText}
      </div>
    </>
  );

  const baseClasses =
    "flex min-h-[104px] flex-col justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200 md:min-h-[106px]";

  const stateClasses = active
    ? "border-[#7C3AED]/60 bg-[#FBF8FF] shadow-[0_0_0_1px_rgba(124,58,237,0.10)] dark:border-[#C084FC]/50 dark:bg-[#161022]"
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

function ChangeIndicator({
  change,
  tooltip,
}: {
  change: number;
  tooltip?: string;
}) {
  const positive = change >= 0;
  const roundedValue = Math.round(Math.abs(change) * 100);

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[11px] font-semibold leading-none md:text-xs",
        tooltip ? "cursor-help" : "",
        positive
          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
      )}
    >
      {positive ? "+" : "-"}
      {roundedValue}%
      {positive ? (
        <ArrowUpRight className="ml-1 h-3 w-3" />
      ) : (
        <ArrowDownRight className="ml-1 h-3 w-3" />
      )}
    </span>
  );
}