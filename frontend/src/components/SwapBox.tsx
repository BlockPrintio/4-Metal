"use client";

import { useState, useEffect } from "react";
import { ArrowDown, Settings2 } from "lucide-react";
import { TokenSelect, type TokenSymbol } from "./TokenSelect";
import { cn } from "@/lib/utils";
import { useOraclePrices } from "@/hooks/useOraclePrices";

interface PanelProps {
  label: string;
  amount: string;
  onAmountChange: (v: string) => void;
  token: TokenSymbol;
  exclude: TokenSymbol;
  onTokenChange: (t: TokenSymbol) => void;
  showMax?: boolean;
}

function Panel({
  label,
  amount,
  onAmountChange,
  token,
  exclude,
  onTokenChange,
  showMax,
}: PanelProps) {
  return (
    <div className="rounded-2xl bg-secondary/60 border border-border/60 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            onAmountChange(v);
          }}
          placeholder="0"
          className="flex-1 min-w-0 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
        />
        <TokenSelect value={token} exclude={exclude} onChange={onTokenChange} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
        <span>Balance: 0</span>
        {showMax && (
          <button
            type="button"
            className="text-gold hover:text-gold/80 font-medium transition-colors"
            onClick={() => onAmountChange("0")}
          >
            Max
          </button>
        )}
      </div>
    </div>
  );
}

export function SwapBox() {
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromToken, setFromToken] = useState<TokenSymbol>("ADA");
  const [toToken, setToToken] = useState<TokenSymbol>("aXAU");

  const { data: prices, isLoading: isPricesLoading } = useOraclePrices();

  useEffect(() => {
    if (!prices || !fromAmount) {
      setToAmount("");
      return;
    }

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      setToAmount("");
      return;
    }

    const adaPrice = prices.ada;
    const xauPrice = prices.xau;
    const xagPrice = prices.xag;

    const getPrice = (t: TokenSymbol) => {
      if (t === "ADA") return adaPrice;
      if (t === "aXAU") return xauPrice;
      if (t === "aXAG") return xagPrice;
      return 0;
    };

    const fromPrice = getPrice(fromToken);
    const toPrice = getPrice(toToken);

    if (!fromPrice || !toPrice) return;

    let calculated = 0;
    if (fromToken === "ADA") {
      // 150% collateral calculation: Minting
      calculated = (amount * fromPrice) / (toPrice * 1.5);
    } else if (toToken === "ADA") {
      // 150% collateral calculation: Redeeming
      calculated = (amount * fromPrice * 1.5) / toPrice;
    } else {
      // Metal to Metal
      calculated = (amount * fromPrice) / toPrice;
    }

    setToAmount(calculated.toLocaleString("en-US", { 
      maximumFractionDigits: 6,
      useGrouping: false 
    }));
  }, [fromAmount, fromToken, toToken, prices]);

  const flip = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    // Let the effect handle the calculation back
  };

  const setFrom = (t: TokenSymbol) => {
    if (t === toToken) setToToken(fromToken);
    setFromToken(t);
  };
  const setTo = (t: TokenSymbol) => {
    if (t === fromToken) setFromToken(toToken);
    setToToken(t);
  };

  const hasAmount = parseFloat(fromAmount || "0") > 0;
  
  // Rate for display: 1 fromToken = ? toToken
  let displayRate = "0";
  if (prices) {
    const fromPrice = (fromToken === "ADA" ? prices.ada : (fromToken === "aXAU" ? prices.xau : prices.xag));
    const toPrice = (toToken === "ADA" ? prices.ada : (toToken === "aXAU" ? prices.xau : prices.xag));
    if (fromToken === "ADA") {
       displayRate = ((1 * fromPrice) / (toPrice * 1.5)).toFixed(6);
    } else if (toToken === "ADA") {
       displayRate = ((1 * fromPrice * 1.5) / toPrice).toFixed(2);
    } else {
       displayRate = (fromPrice / toPrice).toFixed(6);
    }
  }

  return (
    <div className="w-full max-w-[440px] rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Swap</h1>
        <button
          type="button"
          aria-label="Settings"
          className="rounded-full p-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <Panel
          label="From"
          amount={fromAmount}
          onAmountChange={setFromAmount}
          token={fromToken}
          exclude={toToken}
          onTokenChange={setFrom}
          showMax
        />

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button
            type="button"
            onClick={flip}
            aria-label="Flip"
            className="h-10 w-10 rounded-xl border-4 border-card bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        <Panel
          label="To"
          amount={toAmount}
          onAmountChange={setToAmount}
          token={toToken}
          exclude={fromToken}
          onTokenChange={setTo}
        />
      </div>

      <div className="mt-4 rounded-xl bg-secondary/40 border border-border/40 px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          1 {fromToken.startsWith('a') ? <><span className="text-gold lowercase">a</span>{fromToken.slice(1)}</> : fromToken} 
          = {displayRate} {toToken.startsWith('a') ? <><span className="text-gold lowercase">a</span>{toToken.slice(1)}</> : toToken}
        </span>
        <span>Slippage 0.5%</span>
      </div>

      <button
        type="button"
        disabled={!hasAmount}
        className={cn(
          "mt-4 w-full h-12 rounded-2xl font-semibold text-sm transition-all",
          "bg-gradient-to-b from-gold to-[oklch(0.68_0.14_75)] text-gold-foreground",
          "hover:brightness-110 active:brightness-95",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100",
        )}
      >
        {hasAmount ? "Swap" : "Enter an amount"}
      </button>
    </div>
  );
}
