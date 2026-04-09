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
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(value);

  return (
    <section
      className={cn(
        "flex min-w-[110px] flex-col rounded-lg border px-3 py-2 transition-all duration-200",
        warning
          ? "border-amber-400/70 bg-amber-500/10 animate-pulse"
          : "border-border/60 bg-muted/10",
        className
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: color }}
        />
        <h2
          className={cn(
            chartTitle({ color: "mute", size: "sm" }),
            "text-[10px] uppercase tracking-[0.06em]"
          )}
        >
          {title}
        </h2>
      </div>

      <div className="text-[0.95rem] font-semibold leading-none text-foreground">
        {formattedValue}
      </div>

      {helperText && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {helperText}
        </div>
      )}
    </section>
  );
}