import { Coins, TrendingUp, Landmark, Zap } from "lucide-react";
import { addThousandsSeparator } from "@/lib/utils";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";

const yieldSources = [
  {
    label: "Stable Yield",
    color: "#A855F7",
    value: 82500,
    avgYield: 5,
    icon: <Landmark className="h-5 w-5 stroke-[#A855F7]" />,
  },
  {
    label: "Hard Asset Yield",
    color: "#7C3AED",
    value: 45000,
    avgYield: 8,
    icon: <TrendingUp className="h-5 w-5 stroke-[#7C3AED]" />,
  },
  {
    label: "Growth / Risk Yield",
    color: "#C084FC",
    value: 22500,
    avgYield: 10,
    icon: <Zap className="h-5 w-5 stroke-[#C084FC]" />,
  },
];

const totalDistributed = yieldSources.reduce((sum, item) => sum + item.value, 0);

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
              value={option.value}
              avgYield={option.avgYield}
              distributionPercentage={(option.value / totalDistributed) * 100}
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
      <div className="text-2xl font-medium">${addThousandsSeparator(totalDistributed)}</div>
    </div>
  );
}