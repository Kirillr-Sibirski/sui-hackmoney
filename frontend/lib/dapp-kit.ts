// dapp-kit.ts
// Configuration only - no imports that access window

export const GRPC_URLS = {
  testnet: "https://fullnode.testnet.sui.io:443",
} as const;

export type Network = keyof typeof GRPC_URLS;
