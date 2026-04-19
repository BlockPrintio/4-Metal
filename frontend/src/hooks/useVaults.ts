"use client";

import { useQuery } from "@tanstack/react-query";

export interface Vault {
  txHash:      string;
  outputIndex: number;
  owner:       string;
  collateral:  number;   // lovelace
  synthMinted: number;   // 6dp units
  assetClass:  "XAU" | "XAG";
  nftName:     string;
  ratio:       number;   // collateral ratio percent
  underwater:  boolean;  // ratio < 150
  claimAda:    number;   // ADA a liquidator would receive (+10% bonus)
}

export interface VaultsData {
  vaults:   Vault[];
  adaPrice: number;
  xauPrice: number;
  xagPrice: number;
}

export function useVaults() {
  return useQuery<VaultsData>({
    queryKey: ["vaults"],
    queryFn:  async () => {
      const r = await fetch("/api/vaults");
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    // Inherits global 2-minute staleTime + refetchInterval from Providers.
  });
}
