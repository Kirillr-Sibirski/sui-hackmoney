/**
 * DeepBook Margin Transaction Builders
 *
 * Uses the @mysten/deepbook-v3 SDK to build real margin transactions.
 * Steps can be combined into Programmable Transaction Blocks (PTBs) where possible.
 */

import { Transaction } from "@mysten/sui/transactions";
import { DeepBookClient } from "@mysten/deepbook-v3";
import type { MarginManager } from "@mysten/deepbook-v3";

/** Generate a unique client order ID */
function generateClientOrderId(): string {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

/**
 * Extract the MarginManager object ID from a transaction result.
 * Requires `include: { effects: true, objectTypes: true }` when fetching.
 */
export function extractMarginManagerAddress(
  result: {
    $kind: string;
    Transaction?: {
      objectTypes?: Record<string, string>;
      effects?: {
        changedObjects?: Array<{
          objectId: string;
          idOperation: string;
        }>;
      };
    };
  }
): string | null {
  if (result.$kind === "FailedTransaction" || !result.Transaction) {
    return null;
  }

  const objectTypes = result.Transaction.objectTypes ?? {};
  const changedObjects = result.Transaction.effects?.changedObjects ?? [];

  const managerObj = changedObjects.find(
    (obj) =>
      obj.idOperation === "Created" &&
      objectTypes[obj.objectId]?.includes("MarginManager")
  );

  return managerObj?.objectId ?? null;
}

/**
 * Create a DeepBookClient configured with known margin managers.
 */
export function createClientWithManagers(
  suiClient: any,
  address: string,
  marginManagers: Record<string, MarginManager>
): DeepBookClient {
  return new DeepBookClient({
    client: suiClient,
    network: "mainnet",
    address,
    marginManagers,
  });
}

/**
 * Build a single PTB that creates a margin manager, deposits collateral,
 * and shares the manager — all in one transaction.
 *
 * Uses the initializer pattern:
 *   1. newMarginManagerWithInitializer → { manager, initializer }
 *   2. depositDuringInitialization (deposit before sharing)
 *   3. shareMarginManager (makes it a shared on-chain object)
 *
 * Borrow + market order must happen in a separate TX after this,
 * because they require the shared object address.
 */
export function buildCreateManagerAndDepositTx(
  client: DeepBookClient,
  poolKey: string,
  collateralSymbol: string,
  collateralAmount: number
): Transaction {
  const tx = new Transaction();

  // Step 1: Create manager with initializer
  const { manager, initializer } =
    client.marginManager.newMarginManagerWithInitializer(poolKey)(tx);

  // Step 2: Deposit collateral during initialization (before sharing)
  client.marginManager.depositDuringInitialization({
    manager,
    poolKey,
    coinType: collateralSymbol,
    amount: collateralAmount,
  })(tx);

  // Step 3: Share the manager so it becomes a shared object
  client.marginManager.shareMarginManager(poolKey, manager, initializer)(tx);

  return tx;
}

/**
 * Build a PTB that (optionally) borrows and places a market order.
 * The margin manager must already exist and be shared.
 *
 * If borrowAmount <= 0, the borrow step is skipped (fully collateralized).
 */
export function buildBorrowAndOrderTx(
  client: DeepBookClient,
  managerKey: string,
  poolKey: string,
  side: "long" | "short",
  borrowAmount: number,
  orderQuantity: number,
  payWithDeep: boolean
): Transaction {
  const tx = new Transaction();

  // Step 1: Borrow (skip if fully collateralized)
  console.log("borrowing the asset... the manager key is", managerKey)
  if (borrowAmount > 0) {
    if (side === "long") {
      client.marginManager.borrowQuote(managerKey, borrowAmount)(tx);
    } else {
      client.marginManager.borrowBase(managerKey, borrowAmount)(tx);
    }
  }
  console.log("asset borrowed")

  // Step 2: Place market order
  client.poolProxy.placeMarketOrder({
    poolKey,
    marginManagerKey: managerKey,
    clientOrderId: generateClientOrderId(),
    quantity: orderQuantity,
    isBid: side === "long",
    payWithDeep,
  })(tx);
  console.log("placed market order", tx)

  return tx;
}

/**
 * Build a single PTB for returning users (manager already exists):
 * deposit + borrow + market order.
 */
export function buildOpenPositionTx(
  client: DeepBookClient,
  managerKey: string,
  poolKey: string,
  baseAsset: string,
  quoteAsset: string,
  collateralSymbol: string,
  collateralAmount: number,
  side: "long" | "short",
  borrowAmount: number,
  orderQuantity: number
): Transaction {
  const tx = new Transaction();

  // Step 1: Deposit collateral
  const depositFn = getDepositFn(client, collateralSymbol, baseAsset, quoteAsset);
  depositFn({ managerKey, amount: collateralAmount })(tx);

  // Step 2: Borrow (skip if fully collateralized)
  if (borrowAmount > 0) {
    if (side === "long") {
      client.marginManager.borrowQuote(managerKey, borrowAmount)(tx);
    } else {
      client.marginManager.borrowBase(managerKey, borrowAmount)(tx);
    }
  }

  // Step 3: Place market order
  client.poolProxy.placeMarketOrder({
    poolKey,
    marginManagerKey: managerKey,
    clientOrderId: generateClientOrderId(),
    quantity: orderQuantity,
    isBid: side === "long",
    payWithDeep: collateralSymbol === "DEEP",
  })(tx);

  return tx;
}

/**
 * Determine which deposit function to use based on collateral asset
 * relative to the pool's base/quote assets.
 */
function getDepositFn(
  client: DeepBookClient,
  collateralSymbol: string,
  baseAsset: string,
  _quoteAsset: string
) {
  if (collateralSymbol === "DEEP") {
    return client.marginManager.depositDeep.bind(client.marginManager);
  }
  if (collateralSymbol === baseAsset) {
    return client.marginManager.depositBase.bind(client.marginManager);
  }
  return client.marginManager.depositQuote.bind(client.marginManager);
}

/**
 * Build a transaction to deposit collateral only.
 */
export function buildDepositTx(
  client: DeepBookClient,
  managerKey: string,
  baseAsset: string,
  quoteAsset: string,
  collateralSymbol: string,
  amount: number
): Transaction {
  const tx = new Transaction();
  const depositFn = getDepositFn(client, collateralSymbol, baseAsset, quoteAsset);
  depositFn({ managerKey, amount })(tx);
  return tx;
}

/**
 * Build a transaction to withdraw collateral.
 */
export function buildWithdrawTx(
  client: DeepBookClient,
  managerKey: string,
  baseAsset: string,
  collateralSymbol: string,
  amount: number
): Transaction {
  const tx = new Transaction();

  if (collateralSymbol === "DEEP") {
    client.marginManager.withdrawDeep(managerKey, amount)(tx);
  } else if (collateralSymbol === baseAsset) {
    client.marginManager.withdrawBase(managerKey, amount)(tx);
  } else {
    client.marginManager.withdrawQuote(managerKey, amount)(tx);
  }

  return tx;
}

/**
 * Build a transaction to repay debt.
 * If amount is undefined, repays the entire debt.
 */
export function buildRepayTx(
  client: DeepBookClient,
  managerKey: string,
  side: "long" | "short",
  amount?: number
): Transaction {
  const tx = new Transaction();

  if (side === "long") {
    client.marginManager.repayQuote(managerKey, amount)(tx);
  } else {
    client.marginManager.repayBase(managerKey, amount)(tx);
  }

  return tx;
}

/**
 * Build a PTB to close a position: reduce-only order → settle → repay debt.
 *
 * Steps:
 *   1. placeReduceOnlyMarketOrder (sell for long, buy for short)
 *   2. withdrawSettledAmounts (pull settled proceeds into manager)
 *   3. repayQuote (long) / repayBase (short) — repay all debt
 *
 * Withdraw of remaining collateral is done in a separate tx because
 * the exact remaining balance isn't known until this tx completes.
 */
export function buildClosePositionTx(
  client: DeepBookClient,
  managerKey: string,
  poolKey: string,
  side: "long" | "short",
  orderQuantity: number,
  payWithDeep: boolean
): Transaction {
  const tx = new Transaction();

  // Step 1: Place reduce-only market order to close the position
  // Long → sell base (isBid=false), Short → buy base (isBid=true)
  client.poolProxy.placeReduceOnlyMarketOrder({
    poolKey,
    marginManagerKey: managerKey,
    clientOrderId: generateClientOrderId(),
    quantity: orderQuantity,
    isBid: side !== "long",
    payWithDeep,
  })(tx);

  // Step 2: Pull settled amounts into the margin manager
  client.poolProxy.withdrawSettledAmounts(managerKey)(tx);

  // Step 3: Repay all debt
  if (side === "long") {
    client.marginManager.repayQuote(managerKey)(tx);
  } else {
    client.marginManager.repayBase(managerKey)(tx);
  }

  return tx;
}

/**
 * Build a transaction to withdraw all remaining collateral after closing.
 */
export function buildWithdrawAllCollateralTx(
  client: DeepBookClient,
  managerKey: string,
  baseAsset: string,
  collateralSymbol: string,
  amount: number
): Transaction {
  const tx = new Transaction();

  if (collateralSymbol === "DEEP") {
    client.marginManager.withdrawDeep(managerKey, amount)(tx);
  } else if (collateralSymbol === baseAsset) {
    client.marginManager.withdrawBase(managerKey, amount)(tx);
  } else {
    client.marginManager.withdrawQuote(managerKey, amount)(tx);
  }

  return tx;
}

/**
 * Check if an error is a user wallet rejection.
 */
export function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as any)?.message?.toLowerCase?.() ?? "";
  return (
    msg.includes("rejected") ||
    msg.includes("user denied") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("declined")
  );
}

/**
 * Format a transaction error for display.
 */
export function formatTxError(err: unknown): string {
  if (isUserRejection(err)) {
    return "Transaction cancelled";
  }
  const msg = (err as any)?.message ?? "Transaction failed";
  if (msg.length > 120) {
    return `Error: ${msg.slice(0, 117)}...`;
  }
  return `Error: ${msg}`;
}
