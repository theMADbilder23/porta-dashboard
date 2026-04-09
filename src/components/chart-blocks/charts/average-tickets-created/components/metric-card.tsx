import { chartTitle } from "@/components/primitives";
import { addThousandsSeparator, cn } from "@/lib/utils";

export default function MetricCard({
  title,
  value,
  color,
  className,
  helperText,
  warning = false,
  isPercent = false,
}: {
  title: string;
  value: number;
  color: string;
  className?: string;
  helperText?: string;
  warning?: boolean;
  isPercent?: boolean;
}) {
  const formattedValue = isPercent
    ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
    : addThousandsSeparator(value);

  return (
    <section
      className={cn(
        "flex min-w-[122px] flex-col rounded-xl border px-3.5 py-3 transition-all duration-200 md:min-w-[132px] md:px-4 md:py-3.5",
        warning
          ? "border-amber-400/70 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.12)] animate-pulse"
          : "border-border/70 bg-muted/20",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
        />
        <h2
          className={cn(
            chartTitle({ color: "mute", size: "sm" }),
            "text-[10px] uppercase tracking-[0.08em] md:text-[11px]",
          )}
        >
          {title}
        </h2>
      </div>

      <div className="text-[1rem] font-semibold leading-none text-foreground md:text-[1.08rem]">
        {formattedValue}
      </div>

      {helperText ? (
        <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {helperText}
        </div>
      ) : null}
    </section>
  );
}