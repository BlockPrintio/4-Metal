"use client";

import { useQuery } from "@tanstack/react-query";

export interface OraclePrices {
  xau:       number;
  xag:       number;
  ada:       number;
  createdAt: number;
  expiresAt: number;
  stale:     boolean;
}

export function useOraclePrices() {
  return useQuery<OraclePrices>({
    queryKey:       ["oracle"],
    queryFn:        async () => {
      const r = await fetch("/api/oracle");
      if (!r.ok) throw new Error("unavailable");
      return r.json();
    },
    // staleTime + refetchInterval come from the global QueryClient default (10 min).
    // Polling matches the protocol update cycle.
  });
}
