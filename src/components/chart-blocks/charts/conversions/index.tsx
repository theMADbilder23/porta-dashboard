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
    </section>
  );
}