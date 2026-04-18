"use client";

import {

  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type TokenSymbol = "ADA" | "aXAU" | "aXAG";

export const TOKENS: Record<TokenSymbol, { symbol: TokenSymbol; name: string; dotClass: string }> = {
  ADA: { symbol: "ADA", name: "Cardano", dotClass: "bg-sky-400" },
  aXAU: { symbol: "aXAU", name: "Gold", dotClass: "bg-gold" },
  aXAG: { symbol: "aXAG", name: "Silver", dotClass: "bg-silver" },
};

const ALL: TokenSymbol[] = ["ADA", "aXAU", "aXAG"];

interface Props {
  value: TokenSymbol;
  exclude?: TokenSymbol;
  onChange: (t: TokenSymbol) => void;
}

export function TokenSelect({ value, exclude, onChange }: Props) {
  const token = TOKENS[value];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent/80 transition-colors px-3 py-2 text-sm font-medium"
        >
          <span className={cn("h-4 w-4 rounded-full", token.dotClass)} />
          <span>{token.symbol}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 mt-2">
          {ALL.map((sym) => {
            const t = TOKENS[sym];
            const disabled = sym === exclude;
            const selected = sym === value;
            return (
              <button
                key={sym}
                type="button"
                disabled={disabled}
                onClick={() => onChange(sym)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                  "hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed",
                  selected && "bg-accent",
                )}
              >
                <span className={cn("h-8 w-8 rounded-full", t.dotClass)} />
                <div className="flex flex-col">
                  <span className="font-medium">
                    <span className="text-gold lowercase">a</span>{t.symbol.slice(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
