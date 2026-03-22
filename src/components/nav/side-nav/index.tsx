"use client";

import { ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Navigation from "./components/navigation";
import User from "./components/user";
import VisActor from "./components/visactor";

export default function SideNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={cn(
          "fixed left-0 top-12 z-50 rounded-r-md border border-[#D8C8F2] bg-[#F6F0FF] px-2 py-1.5 text-[#7C3AED] dark:border-[#241533] dark:bg-[#100A19] dark:text-[#C084FC]",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-44" : "translate-x-0",
        )}  
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ArrowLeftToLine size={16} />
        ) : (
          <ArrowRightToLine size={16} />
        )}
      </button>
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-40 flex h-[100dvh] w-44 shrink-0 flex-col border-r border-[#D8C8F2] bg-[#F6F0FF] dark:border-[#241533] dark:bg-gradient-to-b dark:from-[#0B0613] dark:via-[#140A1F] dark:to-[#000000]",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <User />
        <Navigation />
        <VisActor />
      </aside>
    </>
  );
}
