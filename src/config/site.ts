import {
  Wallet,
  Bell,
  BarChart3,
  Settings,
  DollarSign,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavigationGrandchildItem = {
  name: string;
  href: string;
};

export type NavigationChildItem = {
  name: string;
  href: string;
  children?: NavigationGrandchildItem[];
};

export type NavigationItem = {
  icon: LucideIcon;
  name: string;
  href: string;
  children?: NavigationChildItem[];
};

export const siteConfig = {
  title: "PORTA",
  description: "AI Portfolio Intelligence System",
};

export const navigations: NavigationItem[] = [
  {
    icon: Wallet,
    name: "Portfolio",
    href: "/",
    children: [
      {
        name: "Overview",
        href: "/",
      },
      {
        name: "Portfolio In-Depth",
        href: "/portfolio/in-depth",
      },
      {
        name: "Wallet Flow / Structure",
        href: "/portfolio/wallet-flow",
      },
      {
        name: "Accounts",
        href: "/portfolio/accounts",
        children: [
          {
            name: "Blockchain Accounts",
            href: "/portfolio/accounts/blockchain",
          },
          {
            name: "Investment Accounts",
            href: "/portfolio/accounts/investment",
          },
          {
            name: "Banking Accounts",
            href: "/portfolio/accounts/banking",
          },
        ],
      },
    ],
  },
  {
    icon: DollarSign,
    name: "Yield",
    href: "/yield",
  },
  {
    icon: Bell,
    name: "Alerts",
    href: "/alerts",
  },
  {
    icon: BarChart3,
    name: "Pulse Center",
    href: "/pulse-center",
  },
  {
    icon: SlidersHorizontal,
    name: "Thresholds",
    href: "/thresholds",
  },
  {
    icon: Settings,
    name: "Settings",
    href: "/settings",
  },
];

export type SiteConfig = typeof siteConfig;