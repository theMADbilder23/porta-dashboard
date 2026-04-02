"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { navigations } from "@/config/site";
import { cn } from "@/lib/utils";

function isPathActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hasActiveGrandchild(
  pathname: string,
  children?: Array<{ name: string; href: string }>
) {
  if (!children?.length) return false;
  return children.some((child) => isPathActive(pathname, child.href));
}

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-grow flex-col gap-y-1 p-2">
      {navigations.map((navigation) => {
        const Icon = navigation.icon;
        const hasChildren = Boolean(navigation.children?.length);

        const topLevelActive =
          isPathActive(pathname, navigation.href) ||
          navigation.children?.some(
            (child) =>
              isPathActive(pathname, child.href) ||
              hasActiveGrandchild(pathname, child.children)
          ) ||
          false;

        const topLevelExpanded = hasChildren && topLevelActive;

        return (
          <div key={navigation.name} className="flex flex-col gap-y-1">
            <Link
              href={navigation.href}
              className={cn(
                "flex items-center rounded-xl px-3 py-2 transition-all duration-200 hover:bg-[#E9DAFF] dark:hover:bg-[#1A1226]",
                topLevelActive
                  ? "bg-[#E6D5FF] text-[#5B21B6] dark:bg-[#221433] dark:text-[#D8B4FE]"
                  : "bg-transparent text-[#3B2A57] dark:text-[#F3E8FF]"
              )}
            >
              <Icon
                size={16}
                className="mr-2 text-[#7C3AED] dark:text-[#C084FC]"
              />
              <span className="text-sm font-medium">{navigation.name}</span>

              {hasChildren ? (
                <ChevronDown
                  size={14}
                  className={cn(
                    "ml-auto text-[#7C3AED] transition-transform dark:text-[#C084FC]",
                    topLevelExpanded && "rotate-180"
                  )}
                />
              ) : null}
            </Link>

            {hasChildren && topLevelExpanded ? (
              <div className="ml-6 flex flex-col gap-y-1 border-l border-[#E9DAFF] pl-3 dark:border-[#2A1D3B]">
                {navigation.children?.map((child) => {
                  const childHasChildren = Boolean(child.children?.length);
                  const childActive =
                    isPathActive(pathname, child.href) ||
                    hasActiveGrandchild(pathname, child.children);
                  const childExpanded = childHasChildren && childActive;

                  return (
                    <div key={child.href} className="flex flex-col gap-y-1">
                      <Link
                        href={child.href}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#E9DAFF] dark:hover:bg-[#1A1226]",
                          childActive
                            ? "bg-[#F3E8FF] font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]"
                            : "text-[#5B4A75] dark:text-[#C4B5FD]"
                        )}
                      >
                        <span>{child.name}</span>

                        {childHasChildren ? (
                          <ChevronDown
                            size={13}
                            className={cn(
                              "ml-auto transition-transform",
                              childExpanded && "rotate-180"
                            )}
                          />
                        ) : null}
                      </Link>

                      {childHasChildren && childExpanded ? (
                        <div className="ml-4 flex flex-col gap-y-1 border-l border-[#EFE7FF] pl-3 dark:border-[#312047]">
                          {child.children?.map((grandchild) => {
                            const grandchildActive = isPathActive(
                              pathname,
                              grandchild.href
                            );

                            return (
                              <Link
                                key={grandchild.href}
                                href={grandchild.href}
                                className={cn(
                                  "rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#E9DAFF] dark:hover:bg-[#1A1226]",
                                  grandchildActive
                                    ? "bg-[#F3E8FF] font-medium text-[#6D28D9] dark:bg-[#241533] dark:text-[#D8B4FE]"
                                    : "text-[#6B5A86] dark:text-[#BFA9F5]"
                                )}
                              >
                                {grandchild.name}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}