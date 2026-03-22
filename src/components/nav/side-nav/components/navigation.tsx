"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigations } from "@/config/site";
import { cn } from "@/lib/utils";

export default function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-grow flex-col gap-y-1 p-2">
      {navigations.map((navigation) => {
        const Icon = navigation.icon;
        return (
<Link
  key={navigation.name}
  href={navigation.href}
  className={cn(
    "flex items-center rounded-xl px-3 py-2 transition-all duration-200 hover:bg-[#E9DAFF] dark:hover:bg-[#1A1226]",
    pathname === navigation.href
      ? "bg-[#E6D5FF] text-[#5B21B6] dark:bg-[#221433] dark:text-[#D8B4FE]"
      : "bg-transparent text-[#3B2A57] dark:text-[#F3E8FF]"
  )}
>
  <Icon
    size={16}
    className="mr-2 text-[#7C3AED] dark:text-[#C084FC]"
  />
  <span className="text-sm font-medium">
    {navigation.name}
  </span>
</Link> 
        );
      })}
    </nav>
  );
}
