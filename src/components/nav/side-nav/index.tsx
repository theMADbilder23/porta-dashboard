"use client";

import { ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Navigation from "./components/navigation";
import User from "./components/user";
import VisActor from "./components/visactor";

export default function SideNav() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside
      className={cn(
        "relative flex h-[100dvh] shrink-0 flex-col border-r transition-all duration-300 ease-in-out",
        "border-[#D8C8F2] bg-[#F6F0FF] dark:border-[#241533] dark:bg-gradient-to-b dark:from-[#0B0613] dark:via-[#140A1F] dark:to-[#000000]",
        isOpen ? "w-44" : "w-12"
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
          "border-[#D8C8F2] bg-[#F6F0FF] text-[#7C3AED] hover:bg-[#E9DAFF]",
          "dark:border-[#241533] dark:bg-[#100A19] dark:text-[#C084FC] dark:hover:bg-[#1A1226]"
        )}
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isOpen ? <ArrowLeftToLine size={14} /> : <ArrowRightToLine size={14} />}
      </button>

      {isOpen ? (
        <>
          <User />
          <Navigation />
          <VisActor />
        </>
      ) : (
        <div className="flex h-full flex-col items-center pt-16">
          <div className="mt-2 h-8 w-8 rounded-full bg-[#E9DAFF] dark:bg-[#1A1226]" />
        </div>
      )}
    </aside>
  );
}