import { TopNav } from "@/components/nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav title="Porfolio Management Intelligence System" />
      <main>{children}</main>
    </>
  );
}
