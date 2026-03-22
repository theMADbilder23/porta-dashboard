import { SmilePlus, ThumbsDown, ThumbsUp } from "lucide-react";

import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";

const yieldSources = [
  {
    label: "Stable Yield",
    color: "#A855F7",
    percentage: 55,
    icon: <ThumbsUp className="h-6 w-6 stroke-[#A855F7] fill-[#A855F7]" />,
  },
  {
    label: "Hard Assets",
    color: "#7C3AED",
    percentage: 30,
    icon: <ThumbsUp className="h-6 w-6 stroke-[#7C3AED] fill-[#7C3AED]" />,
  },
  {
    label: "Growth / Risk",
    color: "#C084FC",
    percentage: 15,
    icon: <ThumbsDown className="h-6 w-6 stroke-[#C084FC] fill-[#C084FC]" />,
  },
];

export default function CustomerSatisfication() {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Yield Sources" icon={SmilePlus} />
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
      <div className="text-xs text-muted-foreground">Total Yield Distribution</div>
      <div className="text-2xl font-medium">$150,000 Yield</div>
    </div>
  );
}
