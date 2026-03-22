import {
  Gauge,
  Wallet,
  BriefcaseBusiness,
  Bell,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type SiteConfig = typeof siteConfig;

export type Navigation = {
  icon: LucideIcon;
  name: string;
  href: string;
};

export const siteConfig = {
  title: "PORTA",
  description: "Portfolio Intelligence System",
};

export const navigations: Navigation[] = [
  {
    icon: Gauge,
    name: "Overview",
    href: "/",
  },
  {
    icon: Wallet,
    name: "Portfolio",
    href: "/portfolio",
  },
  {
    icon: BriefcaseBusiness,
    name: "Wallets",
    href: "/wallets",
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
    icon: Settings,
    name: "Settings",
    href: "/settings",
  },
];
