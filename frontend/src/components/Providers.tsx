"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

// Oracle and vault data polling interval (10 minutes).
const TEN_MINUTES = 10 * 60 * 1000;

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            TEN_MINUTES,
        refetchInterval:      TEN_MINUTES,
        retry:                1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeClient);
  const [MeshProvider, setMeshProvider] = useState<any>(null);

  useEffect(() => {
    // Lazily import Mesh only on the client
    const loadMesh = async () => {
      try {
        const { MeshProvider: Provider } = await import("@meshsdk/react");
        setMeshProvider(() => Provider);
      } catch (err) {
        console.error("Failed to load Mesh SDK:", err);
      }
    };
    loadMesh();
  }, []);

  const content = <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  if (!MeshProvider) {
    return content;
  }

  return (
    <MeshProvider>
      {content}
    </MeshProvider>
  );
}
