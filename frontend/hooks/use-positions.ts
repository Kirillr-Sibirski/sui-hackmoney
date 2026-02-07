"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getStoredPositions, type StoredPosition } from "@/lib/positions";
import { DeepBookClient } from "@mysten/deepbook-v3";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import coins from "@/config/coins.json";
import pools from "@/config/pools.json";

const FLOAT_SCALAR = 1e9;

/** Decimals lookup */
const coinDecimals: Record<string, number> = {};
for (const [symbol, config] of Object.entries(coins.coins)) {
  coinDecimals[symbol] = config.decimals;
}

function getScalar(symbol: string): number {
  return Math.pow(10, coinDecimals[symbol] ?? 9);
}

/** All known pool keys from config */
const ALL_POOL_KEYS = pools.pools.map((p) => p.id);

/** On-chain position state */
export type OnChainPosition = {
  managerAddress: string;
  poolKey: string;
  side: "long" | "short";
  collateralAsset: string;
  createdAt: number;
  // From on-chain
  riskRatio: number;
  baseAsset: number;
  quoteAsset: number;
  baseDebt: number;
  quoteDebt: number;
  basePythPrice: number;
  quotePythPrice: number;
  // Derived
  pool: string;
  baseSymbol: string;
  quoteSymbol: string;
};

/**
 * Hook to fetch live on-chain position state for all margin managers owned by the user.
 * Discovers managers from the on-chain registry (no localStorage needed).
 */
export function usePositions(suiClient: any, walletAddress: string | undefined) {
  const [positions, setPositions] = useState<OnChainPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(true);
  // Stabilize the client ref so the effect only re-runs on refreshKey/walletAddress,
  // not when dapp-kit returns a new client reference after a transaction.
  const clientRef = useRef(suiClient);
  clientRef.current = suiClient;

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!clientRef.current || !walletAddress) {
      setPositions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    discoverAndFetchPositions(clientRef.current, walletAddress).then((results) => {
      if (!mountedRef.current) return;

      console.log("[usePositions] All fetched positions:", results);

      // Filter out positions with negligible equity or zero balances
      const active = results.filter((p) => {
        const hasAssets = p.baseAsset > 0.0001 || p.quoteAsset > 0.0001;
        const hasDebt = p.baseDebt > 0.0001 || p.quoteDebt > 0.0001;
        if (!hasAssets && !hasDebt) return false; // completely empty

        // Compute rough equity: assets - debt (skip if both are ~0)
        // This filters out managers that were fully closed but not cleaned up
        const baseUsd = p.baseAsset * (p.basePythPrice || 1);
        const quoteUsd = p.quoteAsset * (p.quotePythPrice || 1);
        const debtUsd = p.baseDebt * (p.basePythPrice || 1) + p.quoteDebt * (p.quotePythPrice || 1);
        const equityUsd = baseUsd + quoteUsd - debtUsd;

        // Filter out if equity is less than $0.01
        if (equityUsd < 0.01 && !hasDebt) return false;

        return true;
      });

      console.log("[usePositions] Active positions:", active);
      setPositions(active);
      setIsLoading(false);
    }).catch((err) => {
      console.error("[usePositions] Error:", err);
      if (mountedRef.current) {
        setPositions([]);
        setIsLoading(false);
      }
    });
  // NOTE: suiClient intentionally NOT in deps — we use clientRef to avoid
  // re-fetching when dapp-kit returns a new client reference after a wallet transaction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, refreshKey]);

  return { positions, isLoading, refresh };
}

/**
 * Step 1: Discover all margin manager IDs owned by the user from the on-chain registry.
 * Step 2: For each manager, determine which pool it belongs to by trying managerState with each pool key.
 * Step 3: Parse the state and return positions.
 */
async function discoverAndFetchPositions(
  suiClient: any,
  walletAddress: string
): Promise<OnChainPosition[]> {
  const client = new DeepBookClient({
    client: suiClient,
    network: "mainnet",
    address: walletAddress,
  });

  // Step 1: Get all margin manager IDs for this owner
  console.log("[usePositions] Discovering margin managers for:", walletAddress);
  let managerIds: string[];
  try {
    managerIds = await client.getMarginManagerIdsForOwner(walletAddress);
    console.log("[usePositions] Found manager IDs:", managerIds);
  } catch (err) {
    console.error("[usePositions] Failed to get manager IDs:", err);
    return [];
  }

  if (managerIds.length === 0) {
    console.log("[usePositions] No margin managers found for this wallet");
    return [];
  }

  // Load localStorage metadata for collateralAsset lookup
  const storedPositions = getStoredPositions();
  const storedByAddress: Record<string, StoredPosition> = {};
  for (const sp of storedPositions) {
    storedByAddress[sp.managerAddress] = sp;
  }
  console.log("[usePositions] localStorage has", storedPositions.length, "entries");

  // Step 2: For each manager, try each pool key to find which pool it belongs to
  const positions: OnChainPosition[] = [];

  for (const managerId of managerIds) {
    console.log(`[usePositions] Querying state for manager ${managerId}...`);
    const stored = storedByAddress[managerId];
    const position = await tryAllPoolsForManager(suiClient, client, walletAddress, managerId, stored);
    if (position) {
      console.log(`[usePositions] Got position for ${managerId}:`, position);
      positions.push(position);
    } else {
      console.warn(`[usePositions] Could not get state for manager ${managerId} (tried all pools)`);
    }
  }

  return positions;
}

/**
 * Try managerState with each pool key for a given manager.
 * Returns the first successful result, or null if all fail.
 */
async function tryAllPoolsForManager(
  suiClient: any,
  client: DeepBookClient,
  walletAddress: string,
  managerId: string,
  stored?: StoredPosition
): Promise<OnChainPosition | null> {
  // Try all pools in parallel — only one should succeed
  const attempts = ALL_POOL_KEYS.map((poolKey) =>
    queryManagerState(suiClient, client, walletAddress, managerId, poolKey, stored)
      .then((result) => ({ poolKey, result }))
      .catch(() => null)
  );

  const results = await Promise.allSettled(attempts);

  for (const r of results) {
    if (r.status === "fulfilled" && r.value?.result) {
      return r.value.result;
    }
  }

  return null;
}

/**
 * Query managerState for a single manager + pool via simulateTransaction.
 * Returns parsed OnChainPosition or throws on failure.
 */
async function queryManagerState(
  suiClient: any,
  client: DeepBookClient,
  walletAddress: string,
  managerId: string,
  poolKey: string,
  stored?: StoredPosition
): Promise<OnChainPosition | null> {
  const poolConfig = pools.pools.find((p) => p.id === poolKey);
  if (!poolConfig) return null;

  const { baseAsset: baseSymbol, quoteAsset: quoteSymbol } = poolConfig;

  const tx = new Transaction();
  tx.setSender(walletAddress);

  // Build the managerState move call
  client.marginManager.managerState(poolKey, managerId)(tx);

  const simResult = await suiClient.core.simulateTransaction({
    transaction: tx,
    include: { commandResults: true },
  });

  console.log(`[usePositions] managerState sim for ${managerId} / ${poolKey}:`,
    JSON.stringify(simResult, null, 2).slice(0, 1500));

  if (simResult.$kind === "FailedTransaction") {
    console.log(`[usePositions] managerState failed for ${managerId} / ${poolKey} (expected if wrong pool)`);
    return null;
  }

  const commandResults = (simResult as any).commandResults;
  if (!commandResults || !commandResults[0]?.returnValues) {
    console.warn(`[usePositions] No commandResults for ${managerId} / ${poolKey}`);
    return null;
  }

  const returnValues = commandResults[0].returnValues;
  console.log(`[usePositions] returnValues count: ${returnValues.length} for ${managerId} / ${poolKey}`);

  // Log raw BCS data for debugging
  for (let i = 0; i < returnValues.length; i++) {
    const bcsData = returnValues[i].bcs;
    const bcsPreview = typeof bcsData === "string"
      ? bcsData.slice(0, 40)
      : JSON.stringify(bcsData).slice(0, 80);
    console.log(`[usePositions]   returnValues[${i}].bcs = ${bcsPreview}`);
  }

  if (returnValues.length < 11) {
    console.warn(`[usePositions] Only ${returnValues.length} returnValues (need >= 11) for ${managerId} / ${poolKey}`);
    return null;
  }

  try {
    // returnValues[0] = manager_id (Address), [1] = pool_id (Address) — skip
    // returnValues[2] = risk_ratio (u64)
    // returnValues[3] = base_asset (u64), [4] = quote_asset (u64)
    // returnValues[5] = base_debt (u64), [6] = quote_debt (u64)
    // returnValues[7] = base_pyth_price (u64), [8] = base_pyth_decimals (u8)
    // returnValues[9] = quote_pyth_price (u64), [10] = quote_pyth_decimals (u8)
    const riskRatioRaw = decodeBcsU64(returnValues[2].bcs);
    const baseAssetRaw = decodeBcsU64(returnValues[3].bcs);
    const quoteAssetRaw = decodeBcsU64(returnValues[4].bcs);
    const baseDebtRaw = decodeBcsU64(returnValues[5].bcs);
    const quoteDebtRaw = decodeBcsU64(returnValues[6].bcs);
    const basePythPriceRaw = decodeBcsU64(returnValues[7].bcs);
    const quotePythPriceRaw = decodeBcsU64(returnValues[9].bcs);

    // Decimals fields are u8, not u64 — handle carefully
    const basePythDecimals = decodeBcsU8(returnValues[8].bcs);
    const quotePythDecimals = decodeBcsU8(returnValues[10].bcs);

    const baseScalar = getScalar(baseSymbol);
    const quoteScalar = getScalar(quoteSymbol);

    const riskRatio = Number(riskRatioRaw) / FLOAT_SCALAR;
    const baseAssetVal = Number(baseAssetRaw) / baseScalar;
    const quoteAssetVal = Number(quoteAssetRaw) / quoteScalar;
    const baseDebt = Number(baseDebtRaw) / baseScalar;
    const quoteDebt = Number(quoteDebtRaw) / quoteScalar;

    const basePythPrice = Number(basePythPriceRaw) / Math.pow(10, basePythDecimals);
    const quotePythPrice = Number(quotePythPriceRaw) / Math.pow(10, quotePythDecimals);

    // Infer side from debt: quoteDebt > 0 → long (borrowed quote to buy base), baseDebt > 0 → short
    // Prefer localStorage if available (user may have chosen a non-obvious side)
    const side: "long" | "short" = stored?.side ?? (quoteDebt > 0 ? "long" : "short");

    // Use localStorage for the collateral asset (can't be reliably inferred from chain
    // since the original deposit gets mixed into the position after the market order).
    // Fall back to inference if localStorage doesn't have this manager.
    const collateralAsset = stored?.collateralAsset
      ?? (baseAssetVal > 0 ? baseSymbol : quoteSymbol);

    console.log(`[usePositions] collateralAsset for ${managerId}: ${collateralAsset} (source: ${stored ? "localStorage" : "inferred"})`);

    console.log(`[usePositions] Parsed position for ${managerId}:`, {
      poolKey, side, riskRatio,
      baseAsset: baseAssetVal, quoteAsset: quoteAssetVal,
      baseDebt, quoteDebt,
      basePythPrice, quotePythPrice,
      collateralAsset,
    });

    return {
      managerAddress: managerId,
      poolKey,
      side,
      collateralAsset,
      createdAt: 0, // Not available from chain, use 0
      riskRatio,
      baseAsset: baseAssetVal,
      quoteAsset: quoteAssetVal,
      baseDebt,
      quoteDebt,
      basePythPrice,
      quotePythPrice,
      pool: poolConfig.name,
      baseSymbol,
      quoteSymbol,
    };
  } catch (err) {
    console.error(`[usePositions] BCS parse error for ${managerId} / ${poolKey}:`, err);
    return null;
  }
}

/** Convert BCS data to Uint8Array from any format (base64, Uint8Array, or indexed object) */
function toBcsBytes(value: string | Uint8Array | Record<string, number>): Uint8Array {
  if (typeof value === "string") {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } else if (value instanceof Uint8Array) {
    return value;
  } else {
    // Indexed object like {0: 96, 1: 191, ...}
    const len = Object.keys(value).length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = value[i];
    return bytes;
  }
}

/** Decode BCS u64 */
function decodeBcsU64(value: string | Uint8Array | Record<string, number>): bigint {
  const bytes = toBcsBytes(value);
  console.log(`[usePositions] decodeBcsU64 input bytes (${bytes.length}):`, Array.from(bytes));
  const parsed = bcs.u64().parse(bytes);
  return typeof parsed === "string" ? BigInt(parsed) : BigInt(parsed);
}

/** Decode BCS u8 — single byte */
function decodeBcsU8(value: string | Uint8Array | Record<string, number>): number {
  const bytes = toBcsBytes(value);
  console.log(`[usePositions] decodeBcsU8 input bytes (${bytes.length}):`, Array.from(bytes));
  // u8 is just a single byte
  return bcs.u8().parse(bytes);
}
