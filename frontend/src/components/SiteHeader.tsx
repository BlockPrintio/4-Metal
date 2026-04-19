"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function SiteHeader() {
  const pathname = usePathname();
  const [CardanoWallet, setCardanoWallet] = useState<any>(null);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        const { CardanoWallet: Wallet } = await import("@meshsdk/react");
        setCardanoWallet(() => Wallet);
      } catch (err) {
        console.error("Failed to load CardanoWallet:", err);
      }
    };
    loadWallet();
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-5">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="flex -space-x-1.5">
          <span className="h-5 w-5 rounded-full bg-gold border-2 border-background" />
          <span className="h-5 w-5 rounded-full bg-silver border-2 border-background" />
        </div>
        <span className="text-sm font-semibold tracking-tight">4-metal</span>
      </Link>

      <nav className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 text-xs font-medium">
        <Link
          href="/"
          className={cn(
            "px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors",
            pathname === "/" && "bg-accent text-foreground"
          )}
        >
          Home
        </Link>
        <Link
          href="/swap"
          className={cn(
            "px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors",
            pathname === "/swap" && "bg-accent text-foreground"
          )}
        >
          Swap
        </Link>
        <Link
          href="/dashboard"
          className={cn(
            "px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors",
            pathname === "/dashboard" && "bg-accent text-foreground"
          )}
        >
          Oracle
        </Link>
        <Link
          href="/liquidate"
          className={cn(
            "px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors",
            pathname === "/liquidate" && "bg-accent text-foreground"
          )}
        >
          Liquidate
        </Link>
      </nav>

      {CardanoWallet ? (
        <CardanoWallet label="Connect Wallet" isDark={true} />
      ) : (
        <button
          type="button"
          className="rounded-full border border-border bg-card/60 hover:bg-accent transition-colors px-4 py-2 text-xs font-medium opacity-50"
        >
          Connect Wallet
        </button>
      )}
    </header>
  );
}

