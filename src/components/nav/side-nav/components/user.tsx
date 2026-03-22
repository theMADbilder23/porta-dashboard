"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";

export default function User() {
  return (
    <div className="flex h-16 items-center border-b border-[#D8C8F2] bg-[#F6F0FF] px-2 dark:border-[#241533] dark:bg-[#100A19]">
      
      <div className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-[#E9DAFF] dark:hover:bg-[#1A1226] transition-colors">
        
        <div className="flex items-center">
          <Image
            src="/avatar.png"
            alt="User"
            className="mr-2 rounded-full"
            width={36}
            height={36}
          />

          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#5B21B6] dark:text-[#E9D5FF]">
              PORTA
            </span>
            <span className="text-xs text-[#6B4FA3] dark:text-[#C4B5FD]">
              Portfolio Intelligence
            </span>
          </div>
        </div>

        <ChevronDown size={16} className="text-[#7C3AED] dark:text-[#C084FC]" />
      </div>

    </div>
  );
}