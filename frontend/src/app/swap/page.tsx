import { SwapBox } from "@/components/SwapBox";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientGlow } from "@/components/AmbientGlow";

export default function SwapPage() {
  return (
    <main className="relative min-h-screen w-full flex flex-col bg-background selection:bg-gold/30 selection:text-gold">
      <AmbientGlow />
      <SiteHeader />
      
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-24">
        <div className="max-w-2xl text-center mb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Exchange <span className="text-gradient-gold">Synthetic Metals</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Instantly swap ADA for institutional-grade synthetic precious metals, 
            backed by over-collateralized vaults and Charli3 Oracle feeds.
          </p>
        </div>

        <div className="relative group transition-transform duration-500 animate-in fade-in scale-in-95 duration-1000 delay-200">
          <div className="absolute -inset-4 bg-gold/10 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
          <SwapBox />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
