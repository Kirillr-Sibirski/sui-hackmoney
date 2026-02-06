"use client";

import coins from "@/config/coins.json";
import Image from "next/image";

const coinImages: Record<string, string> = Object.fromEntries(
  Object.entries(coins.coins).map(([symbol, coin]) => [symbol, coin.asset_image])
);

export function getCoinImageUrl(symbol: string): string | undefined {
  return coinImages[symbol];
}

interface CoinIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export function CoinIcon({ symbol, size = 16, className }: CoinIconProps) {
  const url = getCoinImageUrl(symbol);
  if (!url) return null;

  return (
    <Image
      src={url}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full ${className ?? ""}`}
      unoptimized
    />
  );
}

interface PoolPairIconProps {
  baseSymbol: string;
  quoteSymbol: string;
  size?: number;
  className?: string;
}

export function PoolPairIcon({ baseSymbol, quoteSymbol, size = 20, className }: PoolPairIconProps) {
  return (
    <span className={`inline-flex items-center -space-x-1.5 ${className ?? ""}`}>
      <CoinIcon symbol={baseSymbol} size={size} className="relative z-10 ring-1 ring-background" />
      <CoinIcon symbol={quoteSymbol} size={size} className="ring-1 ring-background" />
    </span>
  );
}
