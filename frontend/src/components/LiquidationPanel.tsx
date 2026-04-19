"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVaults, type Vault } from "@/hooks/useVaults";

function ratioColor(ratio: number) {
  if (ratio >= 200) return "text-emerald-400";
  if (ratio >= 150) return "text-amber-400";
  return "text-rose-400";
}

function RatioBar({ ratio }: { ratio: number }) {
  const pct = Math.min(ratio, 300) / 300 * 100;
  return (
    <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", ratio >= 200 ? "bg-emerald-400" : ratio >= 150 ? "bg-amber-400" : "bg-rose-500")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function VaultRow({ v }: { v: Vault }) {
  const collateralAda = (v.collateral / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const synth         = (v.synthMinted / 1_000_000).toFixed(6);
  const shortOwner    = `${v.owner.slice(0, 8)}…${v.owner.slice(-6)}`;
  const shortNft      = `${v.txHash.slice(0, 8)}…`;

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-colors",
      v.underwater ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-card/40",
    )}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {v.underwater
              ? <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              : <ShieldCheck    className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            }
            <span className="text-xs font-mono text-muted-foreground">{shortOwner}</span>
            <a
              href={`https://preprod.cardanoscan.io/transaction/${v.txHash}`}
              target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="text-[10px] text-muted-foreground/60 font-mono">NFT: {shortNft}</div>
        </div>

        <div className="flex items-center gap-6 text-right text-xs shrink-0">
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Collateral</div>
            <div className="font-semibold">{collateralAda} ADA</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Debt</div>
            <div className="font-semibold">{synth} {v.assetClass === "XAU" ? "aXAU" : "aXAG"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Ratio</div>
            <div className={cn("font-bold", ratioColor(v.ratio))}>{v.ratio}%</div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <RatioBar ratio={v.ratio} />
        {v.underwater && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-400 font-medium">
              Liquidator receives ≈ {v.claimAda.toFixed(2)} ADA (+10% bonus)
            </span>
            <button
              type="button"
              title="Connect wallet to liquidate — or use: npm run liquidate"
              className="text-[10px] font-semibold px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-not-allowed opacity-70"
              disabled
            >
              Liquidate (wallet required)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-accent/30 transition-colors"
      >
        How liquidation works
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 text-sm text-muted-foreground border-t border-border/60">
          <div className="grid sm:grid-cols-3 gap-4 pt-4">
            {[
              { step: "01", title: "Vault goes underwater", body: "ADA price drops and the vault's collateral ratio falls below 150%. The vault owner's debt is now under-backed." },
              { step: "02", title: "Liquidator burns debt", body: "Anyone holding aXAU/aXAG can call liquidate. They burn the synth tokens (repaying the vault's debt) on-chain." },
              { step: "03", title: "Liquidator gets ADA + bonus", body: "In return they receive the vault's locked ADA plus a 10% bonus — compensation for the service and market risk." },
            ].map(({ step, title, body }) => (
              <div key={step} className="space-y-1">
                <div className="text-[10px] font-bold text-gold tracking-widest">STEP {step}</div>
                <div className="font-semibold text-foreground">{title}</div>
                <p className="text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-secondary/60 border border-border/40 p-3 text-xs font-mono">
            <div className="text-muted-foreground/70 mb-1"># CLI — test on Preprod (Node.js)</div>
            <div>TARGET_VAULT_TX_HASH=&lt;hash&gt; TARGET_VAULT_TX_IDX=0 npm run liquidate</div>
          </div>
          <p className="text-xs">
            This follows the same mechanism as <span className="text-foreground font-medium">MakerDAO</span>, <span className="text-foreground font-medium">Aave</span>, and <span className="text-foreground font-medium">Liquity</span>. The vault owner agreed to these terms when opening the position — liquidation enforces the protocol&apos;s solvency guarantee.
          </p>
        </div>
      )}
    </div>
  );
}

export function LiquidationPanel() {
  // Uses the global 2-minute staleTime + refetchInterval from Providers.
  const { data, isLoading, isError } = useVaults();

  const vaults     = data?.vaults ?? [];
  const underwater = vaults.filter(v => v.underwater);
  const healthy    = vaults.filter(v => !v.underwater);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">
          {isLoading ? "Scanning vaults…" : isError ? "Could not load vault data" : `${vaults.length} vault${vaults.length !== 1 ? "s" : ""} found`}
        </span>
        {underwater.length > 0 && (
          <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            {underwater.length} underwater
          </span>
        )}
        {!isLoading && !isError && underwater.length === 0 && vaults.length > 0 && (
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            All vaults healthy
          </span>
        )}
      </div>

      {/* Underwater vaults first */}
      {underwater.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-rose-400">Underwater — eligible for liquidation</h3>
          {underwater.map(v => <VaultRow key={`${v.txHash}#${v.outputIndex}`} v={v} />)}
        </div>
      )}

      {/* Healthy vaults */}
      {healthy.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Healthy vaults</h3>
          {healthy.map(v => <VaultRow key={`${v.txHash}#${v.outputIndex}`} v={v} />)}
        </div>
      )}

      {!isLoading && !isError && vaults.length === 0 && (
        <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-muted-foreground text-sm">
          No active vaults found at the vault contract address.
        </div>
      )}

      {/* How it works */}
      <HowItWorks />
    </div>
  );
}
