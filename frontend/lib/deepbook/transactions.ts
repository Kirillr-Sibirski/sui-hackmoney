/**
 * DeepBook Margin Transaction Builders
 *
 * This module provides functions for building DeepBook margin transactions.
 * These can be used with the wallet's signAndExecuteTransaction.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type {
  OpenPositionParams,
  ClosePositionParams,
  DepositParams,
  WithdrawParams,
  Side,
} from "./types";

/**
 * Build a transaction to open a leveraged position
 *
 * TODO: Implement using DeepBook margin contracts when ready
 */
export async function buildOpenPositionTx(
  _suiClient: SuiGrpcClient,
  params: OpenPositionParams
): Promise<Transaction> {
  const tx = new Transaction();

  // TODO: Implement actual DeepBook margin position opening
  // This will involve:
  // 1. Getting the margin pool
  // 2. Creating a margin account if needed
  // 3. Depositing collateral
  // 4. Opening a leveraged position using MarginPoolContract

  console.log("Building open position transaction:", params);

  // Placeholder - actual implementation will use DeepBook SDK margin contracts
  // Example flow:
  // 1. Get or create margin account using createDeepBookClient()
  // 2. Deposit collateral using MarginManagerContract
  // 3. Open position using MarginPoolContract

  return tx;
}

/**
 * Build a transaction to close a position
 */
export async function buildClosePositionTx(
  _suiClient: SuiGrpcClient,
  params: ClosePositionParams
): Promise<Transaction> {
  const tx = new Transaction();

  // TODO: Implement actual position closing using MarginPoolContract
  console.log("Building close position transaction:", params);

  return tx;
}

/**
 * Build a transaction to deposit collateral to margin account
 */
export async function buildDepositTx(
  _suiClient: SuiGrpcClient,
  params: DepositParams
): Promise<Transaction> {
  const tx = new Transaction();

  // TODO: Implement deposit using MarginManagerContract
  console.log("Building deposit transaction:", params);

  return tx;
}

/**
 * Build a transaction to withdraw from margin account
 */
export async function buildWithdrawTx(
  _suiClient: SuiGrpcClient,
  params: WithdrawParams
): Promise<Transaction> {
  const tx = new Transaction();

  // TODO: Implement withdrawal using MarginManagerContract
  console.log("Building withdraw transaction:", params);

  return tx;
}

/**
 * Calculate estimated liquidation price for a position
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: Side,
  maintenanceMargin: number = 0.05 // 5% maintenance margin
): number {
  const liquidationDistance = (1 - maintenanceMargin) / leverage;

  if (side === "long") {
    return entryPrice * (1 - liquidationDistance);
  } else {
    return entryPrice * (1 + liquidationDistance);
  }
}

/**
 * Calculate position size from collateral and leverage
 */
export function calculatePositionSize(
  collateral: number,
  leverage: number
): number {
  return collateral * leverage;
}

/**
 * Calculate risk score (2.0 = safe, 1.0 = near liquidation)
 */
export function calculateRiskScore(
  currentPrice: number,
  liquidationPrice: number,
  side: Side
): number {
  const distanceToLiquidation =
    side === "long"
      ? (currentPrice - liquidationPrice) / currentPrice
      : (liquidationPrice - currentPrice) / currentPrice;

  // Normalize to 1.0-2.0 scale
  // At liquidation: 1.0, Far from liquidation: 2.0
  const score = 1 + Math.min(1, Math.max(0, distanceToLiquidation * 2));
  return Math.round(score * 10) / 10;
}
