/**
 * DeepBook Margin Trading Types
 */

export type Side = "long" | "short";

export interface Pool {
  id: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  maxLeverage: number;
  minOrderSize: number;
  tickSize: number;
}

export interface Position {
  id: string;
  poolId: string;
  poolName: string;
  side: Side;
  size: number;
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  liquidationPrice: number;
  pnl: number;
  pnlPercentage: number;
}
