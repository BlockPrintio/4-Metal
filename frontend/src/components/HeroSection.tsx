import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative pt-20 pb-16 md:pt-32 md:pb-24">
      <div className="container mx-auto px-4 text-center">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
          </span>
          <span className="text-xs font-semibold tracking-wide uppercase text-gold">
            Powered by Charli3 Oracles
          </span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          Trade Precious Metals <br />
          <span className="text-gradient-gold">on Cardano</span>
        </h1>

        {/* Subheadline */}
        <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          The first synthetic commodity protocol offering Gold, Silver, and more
          with institutional-grade oracle reliability and zero UTXO contention.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
          <Link href="/swap" className="h-14 px-8 rounded-2xl bg-gold text-gold-foreground font-bold text-sm tracking-tight flex items-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-gold/20">
            Start Trading <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#assets" className="h-14 px-8 rounded-2xl border border-border bg-card/40 backdrop-blur-md text-foreground font-semibold text-sm tracking-tight hover:bg-accent transition-all">
            Explore Assets
          </Link>
        </div>

        {/* Meta Specs */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto opacity-60">
          <div className="flex items-center justify-center gap-3">
            <Zap className="h-5 w-5 text-gold" />
            <span className="text-sm">Instant Settlement</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <ShieldCheck className="h-5 w-5 text-gold" />
            <span className="text-sm">ADA Fully Collateralized</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-gold flex items-center justify-center text-[10px] font-bold text-gold">3</div>
            <span className="text-sm">Multi-Node Oracle Feed</span>
          </div>
        </div>
      </div>

      {/* Background Decorative Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-20 w-full max-w-screen-xl aspect-square">
        <div className="absolute inset-0 bg-gold/5 blur-[120px] rounded-full animate-pulse" />
      </div>
    </section>
  );
}
