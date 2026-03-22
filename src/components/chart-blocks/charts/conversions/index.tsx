import { CirclePercent } from "lucide-react";
import conversions from "@/data/conversions";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";

export default function Conversions() {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="MMII Allocation" icon={CirclePercent} />
      <div className="relative max-h-80 flex-grow">
        <Chart />
      </div>
    </section>
  );
}