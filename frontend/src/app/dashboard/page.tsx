import type { Metadata } from "next";
import { OracleDashboard } from "@/components/OracleDashboard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientGlow } from "@/components/AmbientGlow";

export const metadata: Metadata = {
  title: "4-metal — Oracle Feeds",
  description: "Live Charli3 oracle price feeds for synthetic gold (aXAU), silver (aXAG), and ADA on Cardano.",
  openGraph: {
    title: "4-metal — Oracle Feeds",
    description: "Live Charli3 oracle price feeds for metal-backed assets on Cardano.",
  },
};

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden flex flex-col">
      <AmbientGlow />
      <SiteHeader />
      <div className="flex-1 px-4 py-8">
        <OracleDashboard />
      </div>
      <SiteFooter />
    </main>
  );
}
