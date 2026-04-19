"use client";

import { useState, useEffect } from "react";
import { Radio, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOraclePrices, type OraclePrices } from "@/hooks/useOraclePrices";

const FEEDS = [
  { symbol: "aXAU", dotClass: "bg-gold",    key: "xau" as keyof OraclePrices },
  { symbol: "aXAG", dotClass: "bg-silver",  key: "xag" as keyof OraclePrices },
  { symbol: "ADA",  dotClass: "bg-sky-400", key: "ada" as keyof OraclePrices },
];

function fmtPrice(val: number | null | undefined, key: string) {
  if (val === null || val === undefined) return "—";
  if (key === "ada") return `$${val.toFixed(4)}`;
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OracleDashboard() {
  const { data, isLoading, isError } = useOraclePrices();
  const isStale = data?.stale;
  const isUnavailable = isError || !data;
  const [relativeTime, setRelativeTime] = useState<string>("···");

  useEffect(() => {
    if (!data?.createdAt) return;

    const update = () => {
      const now = Date.now();
      const diff = Math.floor((now - data.createdAt) / 1000);
      
      if (diff < 60) setRelativeTime(`${diff}s ago`);
      else if (diff < 3600) setRelativeTime(`${Math.floor(diff / 60)}m ago`);
      else setRelativeTime(`${Math.floor(diff / 3600)}h ago`);
    };

    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [data?.createdAt]);

  return (
    <div className="w-full border-y border-border/60 bg-card/20 backdrop-blur-sm">
      {/* Stale/Delayed banner — shown when oracle data is expired but still available */}
      {isStale && !isUnavailable && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-tight">
            Price feed delayed — Using last known oracle pulse from {relativeTime}
          </span>
        </div>
      )}

      {/* error banner — shown only if completely unreachable */}
      {isUnavailable && !isLoading && (
        <div className="w-full bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-center">
          <span className="text-xs font-semibold text-rose-400">
            Oracle network connection lost — prices currently unavailable
          </span>
        </div>
      )}

      <div className="overflow-hidden whitespace-nowrap">
        <div className="container mx-auto px-4 flex items-center justify-between">

          {/* Status dot + label */}
          <div className="flex items-center gap-4 py-4 pr-6 border-r border-border/40">
            <div className="relative flex h-3 w-3">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isUnavailable ? "bg-rose-400" : isStale ? "bg-amber-400" : "bg-emerald-400",
              )} />
              <span className={cn(
                "relative inline-flex rounded-full h-3 w-3",
                isUnavailable ? "bg-rose-500" : isStale ? "bg-amber-500" : "bg-emerald-500",
              )} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Charli3 Oracle</span>
              <span className="text-xs font-semibold">
                {isUnavailable ? "Offline" : isStale ? "Delayed" : "Live"}
              </span>
            </div>
          </div>

          {/* Scrolling price ticker */}
          <div className="flex-1 flex overflow-hidden">
            <div className="flex animate-marquee-slow">
              {[...FEEDS, ...FEEDS].map((f, idx) => (
                <div key={idx} className="flex items-center gap-6 px-10 border-r border-border/40 py-4 h-full">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-4 w-4 rounded-full shadow-[0_0_12px] shadow-current",
                      f.dotClass.replace("bg-", "text-"),
                    )} />
                    <span className="font-bold tracking-tighter text-sm uppercase">{f.symbol}</span>
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {isLoading
                      ? <span className="text-muted-foreground">···</span>
                      : data
                        ? fmtPrice(data[f.key] as number, f.key)
                        : <span className="text-muted-foreground">—</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pulse info */}
          <div className="hidden lg:flex flex-col items-end gap-0.5 pl-6 border-l border-border/40">
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Radio className="h-3 w-3 text-gold" />
              Pulse: 600s
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              <Clock className="h-2.5 w-2.5" />
              Last: {isLoading ? "..." : relativeTime}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
