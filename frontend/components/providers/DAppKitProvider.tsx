"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { GRPC_URLS } from "@/lib/dapp-kit";

// Create the dAppKit provider client-side only
const DAppKitProviderClient = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKitMod) =>
      import("@mysten/sui/grpc").then((suiMod) => {
        const { DAppKitProvider, createDAppKit } = dappKitMod;
        const { SuiGrpcClient } = suiMod;

        // Create dAppKit instance
        const dAppKit = createDAppKit({
          networks: ["mainnet"] as const,
          createClient: (network) =>
            new SuiGrpcClient({
              network,
              baseUrl: GRPC_URLS[network as keyof typeof GRPC_URLS],
            }),
        });

        return function ClientProvider({
          children,
        }: {
          children: React.ReactNode;
        }) {
          return (
            <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
          );
        };
      })
    ),
  {
    ssr: false,
  }
);

export function DAppKitProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR, render children without the provider
  if (!mounted) {
    return <>{children}</>;
  }

  return <DAppKitProviderClient>{children}</DAppKitProviderClient>;
}
