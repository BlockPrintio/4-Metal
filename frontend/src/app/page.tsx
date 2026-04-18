import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientGlow } from "@/components/AmbientGlow";
import { HeroSection } from "@/components/HeroSection";
import { OracleDashboard } from "@/components/OracleDashboard";
import { MetalGrid } from "@/components/MetalGrid";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full flex flex-col bg-background selection:bg-gold/30 selection:text-gold">
      <AmbientGlow />
      <SiteHeader />
      
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Live Oracle Ticker */}
      <OracleDashboard />

      {/* 3. The 4 Metals Display */}
      <MetalGrid />

      {/* 4. The Action/CTA Section (Simplified landing version) */}
      <section className="container mx-auto px-4 py-24 flex flex-col items-center">
        <div className="max-w-2xl text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Institutional-Grade <span className="text-gold">Liquidity</span>
          </h2>
          <p className="text-muted-foreground mb-10">
            Join the digital metal revolution on Cardano. Secure, transparent, and fully 
            decentralized access to precious metals markets.
          </p>
          
          <Link href="/swap" className="h-16 px-12 rounded-2xl bg-gold text-gold-foreground font-bold text-lg tracking-tight inline-flex items-center gap-2 hover:brightness-110 transition-all shadow-xl shadow-gold/20">
            Go to Exchange <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* 5. Trust Indicators / Partner section */}
      <section className="container mx-auto px-4 py-24 pb-32 border-t border-border/40">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
           <div className="text-2xl font-black italic tracking-widest uppercase">Cardano</div>
           <div className="text-2xl font-black italic tracking-widest uppercase">Charli3</div>
           <div className="text-2xl font-black italic tracking-widest uppercase">MeshSDK</div>
           <div className="text-2xl font-black italic tracking-widest uppercase">Aiken</div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
