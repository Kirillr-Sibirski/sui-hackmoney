// dapp-kit.ts
// Configuration only - no imports that access window

export const GRPC_URLS = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
} as const;

export type Network = keyof typeof GRPC_URLS;
