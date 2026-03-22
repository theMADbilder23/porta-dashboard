import { Layers3 } from "lucide-react";
import conversions from "@/data/conversions";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";

export default function Conversions() {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="MMII Allocation" icon={Layers3} />
      
      <div className="relative h-[320px] w-full pt-2">
        <Chart />
      </div>

      <AlignmentMeter /> 

    </section>
  );
}
function AlignmentMeter() {
  const idealWeights = {
    "Stable Core": 45,
    "Rotational Core": 32,
    Growth: 16,
    Swing: 7,
  };

  const total = conversions.reduce((sum, item) => sum + item.value, 0);

  const score = Math.max(
    0,
    100 -
      conversions.reduce((penalty, item) => {
        const currentWeight = (item.value / total) * 100;
        const targetWeight =
          idealWeights[item.name as keyof typeof idealWeights] ?? 0;

        return penalty + Math.abs(currentWeight - targetWeight);
      }, 0)
  );

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>MMII Alignment</span>
        <span>{Math.round(score)}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-400 transition-all duration-500"
          style={{ width: `${Math.round(score)}%` }}
        />
      </div>
    </div>
  );
}