"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchPrices,
  subscribeToPrices,
  getQuotePrice,
  type PriceData,
} from "@/lib/oracle";

const FALLBACK_PRICES: Record<string, PriceData> = {
  SUI: { price: 3.45, confidence: 0, timestamp: 0 },
  DEEP: { price: 0.042, confidence: 0, timestamp: 0 },
  WAL: { price: 0.55, confidence: 0, timestamp: 0 },
  USDC: { price: 1, confidence: 0, timestamp: 0 },
};

export function usePrices() {
  const [prices, setPrices] = useState<Record<string, PriceData>>(FALLBACK_PRICES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // Keep a ref that always points to the latest prices — callbacks read from
  // here so their identity never changes, preventing cascading re-renders.
  const pricesRef = useRef(prices);
  pricesRef.current = prices;

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    fetchPrices()
      .then((data) => {
        if (mountedRef.current) {
          setPrices((prev) => ({ ...prev, ...data }));
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          console.error("Failed to fetch initial prices:", err);
          setError("Failed to fetch prices");
          setIsLoading(false);
        }
      });

    // Subscribe to streaming updates, throttled to avoid excessive re-renders
    let pendingData: Record<string, PriceData> | null = null;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = subscribeToPrices((data) => {
      if (!mountedRef.current) return;
      pendingData = data;
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          if (pendingData && mountedRef.current) {
            setPrices((prev) => ({ ...prev, ...pendingData! }));
            pendingData = null;
          }
        }, 2000);
      }
    });

    return () => {
      mountedRef.current = false;
      if (throttleTimer) clearTimeout(throttleTimer);
      cleanup();
    };
  }, []);

  /** Get USD price for a symbol — stable identity, reads from ref */
  const getUsdPrice = useCallback(
    (symbol: string): number => {
      return pricesRef.current[symbol]?.price ?? 0;
    },
    []
  );

  /** Get price of base in terms of quote — stable identity, reads from ref */
  const getPairPrice = useCallback(
    (baseSymbol: string, quoteSymbol: string): number => {
      return getQuotePrice(baseSymbol, quoteSymbol, pricesRef.current);
    },
    []
  );

  return { prices, isLoading, error, getUsdPrice, getPairPrice };
}
