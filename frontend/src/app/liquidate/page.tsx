import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientGlow } from "@/components/AmbientGlow";
import { OracleDashboard } from "@/components/OracleDashboard";
import { LiquidationPanel } from "@/components/LiquidationPanel";

export const metadata: Metadata = {
  title: "4-metal — Liquidations",
  description: "Scan active vaults, identify underwater positions, and earn liquidation rewards.",
};

export default function LiquidatePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden flex flex-col">
      <AmbientGlow />
      <SiteHeader />
      <OracleDashboard />
      <div className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Vault Health Monitor</h1>
          <p className="text-sm text-muted-foreground">
            All active vaults on Preprod. Positions below 150% collateral ratio can be liquidated — liquidators earn a 10% bonus.
          </p>
        </div>
        <LiquidationPanel />
      </div>
      <SiteFooter />
    </main>
  );
}
