"use client";

import { useMemo } from "react";
import { DeepBookClient } from "@mysten/deepbook-v3";
import type { SuiGrpcClient } from "@mysten/sui/grpc";

/**
 * Create a DeepBookClient from a SuiGrpcClient and user address.
 * Separated from hooks so it can be called conditionally.
 */
export function createDeepBookClient(
  suiClient: SuiGrpcClient,
  address: string
): DeepBookClient {
  return new DeepBookClient({
    client: suiClient,
    network: "testnet",
    address,
  });
}
