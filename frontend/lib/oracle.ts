import { HermesClient } from "@pythnetwork/hermes-client";
import priceIds from "@/config/price_ids.json";

const HERMES_ENDPOINT = "https://hermes.pyth.network";

const client = new HermesClient(HERMES_ENDPOINT, {});

// Map symbol → Pyth price feed ID (USD-denominated, stored with 0x prefix)
const PRICE_FEED_IDS: Record<string, string> = priceIds;

// USDC is treated as 1 USD — no oracle needed
const STABLECOIN_SYMBOLS = new Set(["USDC"]);

/** Strip 0x prefix for Pyth API calls */
function stripHex(id: string): string {
  return id.startsWith("0x") ? id.slice(2) : id;
}

/** Normalize to 0x-prefixed for internal matching */
function withHex(id: string): string {
  return id.startsWith("0x") ? id : "0x" + id;
}

/** All symbols that have a Pyth price feed */
export function getOracleSymbols(): string[] {
  return Object.keys(PRICE_FEED_IDS);
}

/** Get all price feed IDs for fetching (without 0x prefix for Pyth API) */
export function getAllPriceFeedIds(): string[] {
  return Object.values(PRICE_FEED_IDS).map(stripHex);
}

export interface PriceData {
  price: number;
  confidence: number;
  timestamp: number;
}

/**
 * Parse a Pyth price update into a numeric price.
 * Pyth returns price as a string with an exponent.
 */
function parsePythPrice(priceObj: { price: string; expo: number }): number {
  return parseFloat(priceObj.price) * Math.pow(10, priceObj.expo);
}

/** Find symbol by feed ID (handles with/without 0x prefix) */
function findSymbolByFeedId(feedId: string): string | undefined {
  const normalized = withHex(feedId);
  const symbols = getOracleSymbols();
  return symbols.find((s) => PRICE_FEED_IDS[s] === normalized);
}

/**
 * Fetch latest USD prices for all configured symbols from Pyth.
 * Returns a map of symbol → PriceData.
 */
export async function fetchPrices(): Promise<Record<string, PriceData>> {
  const ids = getAllPriceFeedIds();

  const result: Record<string, PriceData> = {
    USDC: { price: 1, confidence: 0, timestamp: Date.now() / 1000 },
  };

  if (ids.length === 0) return result;

  const updates = await client.getLatestPriceUpdates(ids);

  if (updates?.parsed) {
    for (const feed of updates.parsed) {
      const symbol = findSymbolByFeedId(feed.id);
      if (symbol && feed.price) {
        result[symbol] = {
          price: parsePythPrice(feed.price),
          confidence: parsePythPrice({
            price: feed.price.conf,
            expo: feed.price.expo,
          }),
          timestamp: feed.price.publish_time,
        };
      }
    }
  }

  return result;
}

/**
 * Subscribe to real-time price updates via SSE.
 * Calls onUpdate with the full price map whenever any price changes.
 * Returns a cleanup function.
 */
export function subscribeToPrices(
  onUpdate: (prices: Record<string, PriceData>) => void
): () => void {
  const ids = getAllPriceFeedIds();
  if (ids.length === 0) return () => {};

  const prices: Record<string, PriceData> = {
    USDC: { price: 1, confidence: 0, timestamp: Date.now() / 1000 },
  };

  let eventSource: EventSource | null = null;

  (async () => {
    try {
      eventSource = await client.getPriceUpdatesStream(ids);

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.parsed) {
            for (const feed of data.parsed) {
              const symbol = findSymbolByFeedId(feed.id);
              if (symbol && feed.price) {
                prices[symbol] = {
                  price: parsePythPrice(feed.price),
                  confidence: parsePythPrice({
                    price: feed.price.conf,
                    expo: feed.price.expo,
                  }),
                  timestamp: feed.price.publish_time,
                };
              }
            }
            onUpdate({ ...prices });
          }
        } catch {
          // Ignore parse errors in stream
        }
      };

      eventSource.onerror = () => {
        // SSE will auto-reconnect
      };
    } catch {
      // Fall back silently — prices will use last known values
    }
  })();

  return () => {
    eventSource?.close();
  };
}

/**
 * Get the price of baseSymbol in terms of quoteSymbol.
 * e.g. getQuotePrice("SUI", "USDC", prices) → SUI price in USD
 * e.g. getQuotePrice("DEEP", "SUI", prices) → DEEP price in SUI
 */
export function getQuotePrice(
  baseSymbol: string,
  quoteSymbol: string,
  prices: Record<string, PriceData>
): number {
  const baseUsd = prices[baseSymbol]?.price ?? 0;
  const quoteUsd = prices[quoteSymbol]?.price ?? 0;
  if (quoteUsd === 0) return 0;
  return baseUsd / quoteUsd;
}
