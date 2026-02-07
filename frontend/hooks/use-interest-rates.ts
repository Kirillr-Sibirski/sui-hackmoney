"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DeepBookClient } from "@mysten/deepbook-v3";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";

const FLOAT_SCALAR = 1e9;

/** All margin pool coin keys */
const MARGIN_POOL_COINS = ["SUI", "USDC", "DEEP", "WAL"] as const;

/**
 * Hook to fetch on-chain interest rates for all margin pools.
 * Returns a map of coinKey → annualized rate (e.g. 0.085 = 8.5%).
 */
export function useInterestRates(suiClient: any, walletAddress: string | undefined) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(() => {
    if (!suiClient || !walletAddress) return;
    fetchRates(suiClient, walletAddress).then((r) => {
      if (mountedRef.current) setRates(r);
    });
  }, [suiClient, walletAddress]);

  useEffect(() => {
    if (!suiClient || !walletAddress) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchRates(suiClient, walletAddress)
      .then((r) => {
        if (mountedRef.current) {
          setRates(r);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("[useInterestRates] Error:", err);
        if (mountedRef.current) setIsLoading(false);
      });
  }, [suiClient, walletAddress]);

  return { rates, isLoading, refresh };
}

/**
 * Fetch interest rates for all margin pool coins in a single simulation.
 * Each coin gets its own moveCall, all in one transaction.
 */
async function fetchRates(
  suiClient: any,
  walletAddress: string
): Promise<Record<string, number>> {
  const client = new DeepBookClient({
    client: suiClient,
    network: "mainnet",
    address: walletAddress,
  });

  const tx = new Transaction();
  tx.setSender(walletAddress);

  // Add one interestRate call per coin
  for (const coinKey of MARGIN_POOL_COINS) {
    client.marginPool.interestRate(coinKey)(tx);
  }

  const simResult = await suiClient.core.simulateTransaction({
    transaction: tx,
    include: { commandResults: true },
  });

  if (simResult.$kind === "FailedTransaction") {
    console.warn("[useInterestRates] Simulation failed:", simResult.FailedTransaction);
    return {};
  }

  // commandResults is a top-level key on simResult (not nested inside .Transaction)
  const commandResults = (simResult as any).commandResults;
  if (!commandResults) {
    console.warn("[useInterestRates] No commandResults. Keys:", Object.keys(simResult));
    return {};
  }

  const rates: Record<string, number> = {};
  for (let i = 0; i < MARGIN_POOL_COINS.length; i++) {
    const returnValues = commandResults[i]?.returnValues;
    if (!returnValues || returnValues.length === 0) continue;

    const raw = decodeBcsU64(returnValues[0].bcs);
    rates[MARGIN_POOL_COINS[i]] = Number(raw) / FLOAT_SCALAR;
  }

  console.log("[useInterestRates] Fetched rates:", rates);
  return rates;
}

function decodeBcsU64(value: string | Uint8Array | Record<string, number>): bigint {
  let bytes: Uint8Array;
  if (typeof value === "string") {
    bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } else if (value instanceof Uint8Array) {
    bytes = value;
  } else {
    const len = Object.keys(value).length;
    bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = value[i];
  }
  const parsed = bcs.u64().parse(bytes);
  return typeof parsed === "string" ? BigInt(parsed) : BigInt(parsed);
}
