/**
 * DeepBook Client Configuration
 *
 * This module handles the DeepBook client setup and configuration.
 */

import {
  DeepBookClient,
  mainnetPackageIds,
  mainnetMarginPools,
  mainnetCoins,
} from "@mysten/deepbook-v3";
import type { SuiGrpcClient } from "@mysten/sui/grpc";

// Re-export useful constants
export { mainnetPackageIds, mainnetMarginPools, mainnetCoins };

// DeepBook configuration
export const DEEPBOOK_CONFIG = {
  mainnet: {
    ...mainnetPackageIds,
  },
} as const;

/**
 * Create a DeepBook client instance for a specific user address
 */
export function createDeepBookClient(
  suiClient: SuiGrpcClient,
  address: string
): DeepBookClient {
  return new DeepBookClient({
    client: suiClient,
    network: "mainnet",
    address,
  });
}

/**
 * Convert a decimal amount to the smallest unit based on decimals
 */
export function toSmallestUnit(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

/**
 * Convert from smallest unit to decimal based on decimals
 */
export function fromSmallestUnit(amount: bigint, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}
