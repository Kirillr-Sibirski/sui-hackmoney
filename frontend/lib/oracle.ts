import { HermesClient } from "@pythnetwork/hermes-client";
import priceIds from "@/config/price_ids.json";

const HERMES_ENDPOINT = "https://hermes.pyth.network";

const client = new HermesClient(HERMES_ENDPOINT, {});

// Map symbol → Pyth price feed ID (USD-denominated)
const PRICE_FEED_IDS: Record<string, string> = priceIds;

// DBUSDC is treated as 1 USD — no oracle needed
const STABLECOIN_SYMBOLS = new Set(["DBUSDC"]);

/** All symbols that have a Pyth price feed */
export function getOracleSymbols(): string[] {
  return Object.keys(PRICE_FEED_IDS);
}

/** Get all price feed IDs for fetching */
export function getAllPriceFeedIds(): string[] {
  return Object.values(PRICE_FEED_IDS);
}

/** Get the price feed ID for a symbol, or null if stablecoin/unknown */
export function getPriceFeedId(symbol: string): string | null {
  if (STABLECOIN_SYMBOLS.has(symbol)) return null;
  return PRICE_FEED_IDS[symbol] ?? null;
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

/**
 * Fetch latest USD prices for all configured symbols from Pyth.
 * Returns a map of symbol → PriceData.
 */
export async function fetchPrices(): Promise<Record<string, PriceData>> {
  const symbols = getOracleSymbols();
  const ids = symbols.map((s) => PRICE_FEED_IDS[s]);

  const result: Record<string, PriceData> = {
    DBUSDC: { price: 1, confidence: 0, timestamp: Date.now() / 1000 },
  };

  if (ids.length === 0) return result;

  const updates = await client.getLatestPriceUpdates(ids);

  if (updates?.parsed) {
    for (const feed of updates.parsed) {
      // Match feed ID back to symbol
      const feedId = "0x" + feed.id;
      const symbol = symbols.find((s) => PRICE_FEED_IDS[s] === feedId);
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
    DBUSDC: { price: 1, confidence: 0, timestamp: Date.now() / 1000 },
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
              const feedId = "0x" + feed.id;
              const symbols = getOracleSymbols();
              const symbol = symbols.find((s) => PRICE_FEED_IDS[s] === feedId);
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
 * e.g. getQuotePrice("SUI", "DBUSDC", prices) → SUI price in USD
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
