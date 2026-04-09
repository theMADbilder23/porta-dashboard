import type { Metadata } from "next";
import { Gabarito } from "next/font/google";
import { SideNav } from "@/components/nav";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import "@/style/globals.css";
import { Providers } from "./providers";

const gabarito = Gabarito({ subsets: ["latin"], variable: "--font-gabarito" });

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("h-screen overflow-hidden bg-background font-sans", gabarito.variable)}>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <SideNav />
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}