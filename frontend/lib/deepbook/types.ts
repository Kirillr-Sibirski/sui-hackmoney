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

export interface OpenPositionParams {
  poolId: string;
  side: Side;
  collateralAmount: bigint;
  collateralAsset: string;
  leverage: number;
}

export interface ClosePositionParams {
  poolId: string;
  positionId: string;
}

export interface DepositParams {
  asset: string;
  amount: bigint;
}

export interface WithdrawParams {
  asset: string;
  amount: bigint;
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

export interface AccountBalance {
  asset: string;
  tradingBalance: bigint;
  walletBalance: bigint;
}
