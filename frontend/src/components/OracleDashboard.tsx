import { Activity, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface Feed {
  symbol: string;
  dotClass: string;
  pair: string;
}

const FEEDS: Feed[] = [
  { symbol: "aXAU", dotClass: "bg-gold", pair: "XAU / USD" },
  { symbol: "aXAG", dotClass: "bg-silver", pair: "XAG / USD" },
  { symbol: "ADA", dotClass: "bg-sky-400", pair: "ADA / USD" },
];

function TickerItem({ feed }: { feed: Feed }) {
  return (
    <div className="flex items-center gap-6 px-10 border-r border-border/40 py-4 h-full">
      <div className="flex items-center gap-3">
        <div className={cn("h-4 w-4 rounded-full shadow-[0_0_12px] shadow-current", feed.dotClass.replace('bg-', 'text-'))} />
        <span className="font-bold tracking-tighter text-sm uppercase">{feed.symbol}</span>
      </div>
      <div className="flex flex-col items-end">
        <div className="text-sm font-mono font-semibold">$0.00</div>
        <div className="text-[10px] text-emerald-400 font-bold">+0.00%</div>
      </div>
    </div>
  );
}

export function OracleDashboard() {
  return (
    <div className="w-full border-y border-border/60 bg-card/20 backdrop-blur-sm overflow-hidden whitespace-nowrap">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-4 py-4 pr-6 border-r border-border/40">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Charli3 Oracle</span>
            <span className="text-xs font-semibold">Preprod Network</span>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex animate-marquee-slow">
             {/* Duplicate for infinite loop effect if container was wider, 
                 but here we'll just show them statically for the "simple" look */}
            {FEEDS.map((f) => (
              <TickerItem key={f.symbol} feed={f} />
            ))}
            {FEEDS.map((f) => (
              <TickerItem key={f.symbol + '_dup'} feed={f} />
            ))}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 pl-6 border-l border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <Radio className="h-3 w-3 text-gold" />
          Pulse: 120s
        </div>
      </div>
    </div>
  );
}
