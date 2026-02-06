/**
 * DeepBook Margin Transaction Builders
 *
 * Uses the @mysten/deepbook-v3 SDK to build real margin transactions.
 * All steps can be combined into a single Programmable Transaction Block (PTB).
 */

import { Transaction } from "@mysten/sui/transactions";
import { DeepBookClient } from "@mysten/deepbook-v3";
import type { MarginManager } from "@mysten/deepbook-v3";

/**
 * Build a transaction to create a new margin manager for a pool.
 * The manager must exist before deposits/borrows/orders can be made.
 */
export function buildNewMarginManagerTx(
  client: DeepBookClient,
  poolKey: string
): Transaction {
  const tx = new Transaction();
  client.marginManager.newMarginManager(poolKey)(tx);
  return tx;
}

/**
 * Extract the MarginManager object ID from a transaction result.
 * After executing newMarginManager, the created shared object ID is found
 * in the transaction effects' changedObjects.
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
    network: "testnet",
    address,
    marginManagers,
  });
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
  // quoteAsset or any other — depositQuote
  return client.marginManager.depositQuote.bind(client.marginManager);
}

/** Generate a unique client order ID */
function generateClientOrderId(): string {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

/**
 * Build a single PTB that deposits collateral, borrows, and places a market order.
 *
 * Steps in one transaction:
 *   1. Deposit collateral (depositBase/Quote/Deep)
 *   2. Borrow debt (borrowBase/Quote)
 *   3. Place market order via poolProxy (placeMarketOrder)
 *
 * @param client           - DeepBookClient with marginManagers configured
 * @param managerKey       - The margin manager key (maps to { address, poolKey })
 * @param poolKey          - The pool key (e.g. "SUI_DBUSDC")
 * @param baseAsset        - Base asset symbol (e.g. "SUI")
 * @param quoteAsset       - Quote asset symbol (e.g. "DBUSDC")
 * @param collateralSymbol - Which asset the user deposits as collateral
 * @param collateralAmount - Human-readable collateral amount
 * @param side             - "long" or "short"
 * @param borrowAmount     - Human-readable borrow amount (in borrowed asset)
 * @param orderQuantity    - Market order quantity in base asset (= amount * leverage)
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

  // Step 2: Borrow — direction determines which asset to borrow
  // Long: borrow quote (to buy more base)
  // Short: borrow base (to sell for quote)
  if (side === "long") {
    client.marginManager.borrowQuote(managerKey, borrowAmount)(tx);
  } else {
    client.marginManager.borrowBase(managerKey, borrowAmount)(tx);
  }

  // Step 3: Place market order
  // isBid = true for long (buying base), false for short (selling base)
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

  // Repay the asset that was borrowed
  if (side === "long") {
    client.marginManager.repayQuote(managerKey, amount)(tx);
  } else {
    client.marginManager.repayBase(managerKey, amount)(tx);
  }

  return tx;
}
