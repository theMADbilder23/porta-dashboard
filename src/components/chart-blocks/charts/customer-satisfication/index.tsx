import { Coins, TrendingUp, Landmark, Zap } from "lucide-react";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";

const yieldSources = [
  {
    label: "Stable Yield",
    color: "#A855F7",
    percentage: 0.05,
    icon: <Landmark className="h-6 w-6 stroke-[#A855F7]" />,
  },
  {
    label: "Hard Asset Yield",
    color: "#7C3AED",
    percentage: 0.08,
    icon: <TrendingUp className="h-6 w-6 stroke-[#7C3AED]" />,
  },
  {
    label: "Growth / Risk Yield",
    color: "#C084FC",
    percentage: 0.10,
    icon: <Zap className="h-6 w-6 stroke-[#C084FC]" />,
  },
];

export default function CustomerSatisfication() {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Yield Summary" icon={Coins} />
      <div className="my-4 flex h-full items-center justify-between">
        <div className="mx-auto grid w-full grid-cols-2 gap-6">
          <TotalCustomers />
          {yieldSources.map((option) => (
            <LinearProgress
              key={option.label}
              label={option.label}
              color={option.color}
              percentage={option.percentage}
              icon={option.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TotalCustomers() {
  return (
    <div className="flex flex-col items-start justify-center">
      <div className="text-xs text-muted-foreground">Total Value Distributed</div>
      <div className="text-2xl font-medium">$150,000</div>
    </div>
  );
}