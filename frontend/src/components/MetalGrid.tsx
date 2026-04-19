"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, Clock } from "lucide-react";
import { useOraclePrices } from "@/hooks/useOraclePrices";

interface MetalCardProps {
  name:         string;
  symbol:       string;
  price:        string;
  colorClass:   string;
  gradientClass: string;
  isComingSoon?: boolean;
}

function MetalCard({ name, symbol, price, colorClass, gradientClass, isComingSoon }: MetalCardProps) {
  return (
    <div className={cn(
      "group relative rounded-3xl border border-border bg-card/40 backdrop-blur-xl p-8 transition-all hover:border-gold/30 hover:bg-card/60",
      isComingSoon && "opacity-75 grayscale-[0.5]"
    )}>
      <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity">
        <div className={cn("h-16 w-16 blur-2xl rounded-full", colorClass)} />
      </div>

      {isComingSoon && (
        <div className="absolute top-4 right-4 z-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-2.5 py-1 text-[10px] font-bold text-muted-foreground border border-border">
            <Clock className="h-3 w-3" />
            COMING SOON
          </span>
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg border border-white/10", gradientClass)}>
            {symbol.slice(1, 4)}
          </div>
          <div>
            <h3 className="font-bold text-lg tracking-tight">{name}</h3>
            <span className="text-xs text-muted-foreground uppercase font-medium tracking-widest leading-none">
              <span className="text-gold lowercase">a</span>{symbol.slice(1)}
            </span>
          </div>
        </div>

        <div className="mt-auto">
          <div className="text-3xl font-bold tracking-tight mb-2">
            {isComingSoon ? "—" : price}
          </div>
          {!isComingSoon && (
            <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              Live · Charli3
            </div>
          )}
          {isComingSoon && (
            <div className="text-[10px] font-medium text-muted-foreground/60 italic">
              Awaiting liquidity pool activation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(val: number, decimals = 2) {
  return `$${val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function MetalGrid() {
  const { data } = useOraclePrices();

  const metals: MetalCardProps[] = [
    {
      name:          "Gold",
      symbol:        "aXAU",
      price:         data ? fmt(data.xau) : "···",
      colorClass:    "bg-gold",
      gradientClass: "bg-gradient-to-br from-gold/50 to-gold text-gold-foreground",
    },
    {
      name:          "Silver",
      symbol:        "aXAG",
      price:         data ? fmt(data.xag) : "···",
      colorClass:    "bg-silver",
      gradientClass: "bg-gradient-to-br from-white/10 to-silver text-foreground",
    },
    {
      name:          "Platinum",
      symbol:        "aXPT",
      price:         "—",
      colorClass:    "bg-slate-300",
      gradientClass: "bg-gradient-to-br from-slate-400 to-slate-200 text-slate-900",
      isComingSoon:  true,
    },
    {
      name:          "Palladium",
      symbol:        "aXPD",
      price:         "—",
      colorClass:    "bg-orange-300",
      gradientClass: "bg-gradient-to-br from-orange-400 to-orange-200 text-orange-950",
      isComingSoon:  true,
    },
  ];

  return (
    <section id="assets" className="container mx-auto px-4 py-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Supported Market Assets</h2>
          <p className="text-muted-foreground">
            Synthetic commodities maintain 1:1 price parity with physical reserves through
            over-collateralised ADA vaults and real-time Charli3 oracle aggregation.
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary/60 px-4 py-2 rounded-xl border border-border">
          REF: CHARLI3_AGGR_PROTO_V1
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metals.map((metal) => (
          <MetalCard key={metal.symbol} {...metal} />
        ))}
      </div>
    </section>
  );
}
