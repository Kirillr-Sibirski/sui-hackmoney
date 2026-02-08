/**
 * DeepBook Margin Transaction Builders
 *
 * Uses the @mysten/deepbook-v3 SDK to build real margin transactions.
 * Steps can be combined into Programmable Transaction Blocks (PTBs) where possible.
 */

import { Transaction } from "@mysten/sui/transactions";
import { DeepBookClient } from "@mysten/deepbook-v3";
import { bcs } from "@mysten/sui/bcs";
import type { MarginManager } from "@mysten/deepbook-v3";
import coins from "@/config/coins.json";

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
    console.log("Borrow amount", borrowAmount);
    if (side === "long") {
      client.marginManager.borrowQuote(managerKey, Number(borrowAmount))(tx);
    } else {
      client.marginManager.borrowBase(managerKey, borrowAmount)(tx);
    }
  }

  // // Step 2: Place market order
  // client.poolProxy.placeMarketOrder({
  //   poolKey,
  //   marginManagerKey: managerKey,
  //   clientOrderId: generateClientOrderId(),
  //   quantity: orderQuantity,
  //   isBid: side === "long",
  //   payWithDeep,
  // })(tx);
  // console.log("placed market order", tx)

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
 * Build a simulation TX: close position + query resulting manager state.
 * Used to determine exact post-close balances for the withdrawal step.
 *
 * Commands:
 *   0: placeMarketOrder
 *   1: withdrawSettledAmounts
 *   2: repayQuote/repayBase
 *   3: managerState (read post-close balances)
 */
export function buildCloseSimulationTx(
  client: DeepBookClient,
  managerKey: string,
  poolKey: string,
  managerAddress: string,
  side: "long" | "short",
  orderQuantity: number,
  payWithDeep: boolean
): Transaction {
  const tx = new Transaction();

  client.poolProxy.placeMarketOrder({
    poolKey,
    marginManagerKey: managerKey,
    clientOrderId: generateClientOrderId(),
    quantity: orderQuantity,
    isBid: side !== "long",
    payWithDeep,
  })(tx);

  client.poolProxy.withdrawSettledAmounts(managerKey)(tx);

  if (side === "long") {
    client.marginManager.repayQuote(managerKey)(tx);
  } else {
    client.marginManager.repayBase(managerKey)(tx);
  }

  // Query the resulting state so we know exact remaining balances
  client.marginManager.managerState(poolKey, managerAddress)(tx);

  return tx;
}

/**
 * Parse remaining base/quote amounts from a close simulation result.
 * managerState is at the given command index.
 */
export function parsePostCloseBalances(
  simResult: any,
  stateCommandIndex: number,
  baseSymbol: string,
  quoteSymbol: string
): { baseAmount: number; quoteAmount: number } {
  const coinConfig = coins.coins as Record<string, { decimals: number }>;
  const baseScalar = Math.pow(10, coinConfig[baseSymbol]?.decimals ?? 9);
  const quoteScalar = Math.pow(10, coinConfig[quoteSymbol]?.decimals ?? 6);

  const returnValues = (simResult as any).commandResults?.[stateCommandIndex]?.returnValues;
  if (!returnValues || returnValues.length < 7) {
    throw new Error(`Unexpected simulation returnValues (len=${returnValues?.length})`);
  }

  const baseAssetRaw = Number(decodeBcsU64(returnValues[3].bcs));
  const quoteAssetRaw = Number(decodeBcsU64(returnValues[4].bcs));

  return {
    baseAmount: baseAssetRaw / baseScalar,
    quoteAmount: quoteAssetRaw / quoteScalar,
  };
}

/**
 * Build a single PTB to fully close a position in ONE transaction:
 *   1. placeMarketOrder (sell for long, buy for short)
 *   2. withdrawSettledAmounts
 *   3. repayQuote / repayBase (all debt)
 *   4. withdrawBase + withdrawQuote (remaining assets)
 *   5. transferObjects (send withdrawn Coins to the user)
 *
 * Withdrawal amounts come from simulating steps 1-3 first.
 */
export function buildFullClosePositionTx(
  client: DeepBookClient,
  managerKey: string,
  poolKey: string,
  side: "long" | "short",
  orderQuantity: number,
  payWithDeep: boolean,
  withdrawBaseAmount: number,
  withdrawQuoteAmount: number,
  senderAddress: string
): Transaction {
  const tx = new Transaction();

  // Step 1: Place market order to close the position
  client.poolProxy.placeMarketOrder({
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

  // Step 4: Withdraw remaining assets — returns Coin objects that MUST be transferred
  const coinsToTransfer: any[] = [];
  if (withdrawBaseAmount > 0) {
    const baseCoin = client.marginManager.withdrawBase(managerKey, withdrawBaseAmount)(tx);
    coinsToTransfer.push(baseCoin);
  }
  if (withdrawQuoteAmount > 0) {
    const quoteCoin = client.marginManager.withdrawQuote(managerKey, withdrawQuoteAmount)(tx);
    coinsToTransfer.push(quoteCoin);
  }

  // Step 5: Transfer coins to the user's wallet
  if (coinsToTransfer.length > 0) {
    tx.transferObjects(coinsToTransfer, senderAddress);
  }

  return tx;
}

/**
 * Build a TX to withdraw all assets from a margin manager (no sell, no repay).
 * Used for 1x positions that have no debt — just need to pull collateral out.
 * Properly transfers returned Coin objects to the sender.
 */
export function buildWithdrawOnlyTx(
  client: DeepBookClient,
  managerKey: string,
  baseAmount: number,
  quoteAmount: number,
  senderAddress: string
): Transaction {
  const tx = new Transaction();

  const coinsToTransfer: any[] = [];
  if (baseAmount > 0) {
    const baseCoin = client.marginManager.withdrawBase(managerKey, baseAmount)(tx);
    coinsToTransfer.push(baseCoin);
  }
  if (quoteAmount > 0) {
    const quoteCoin = client.marginManager.withdrawQuote(managerKey, quoteAmount)(tx);
    coinsToTransfer.push(quoteCoin);
  }

  if (coinsToTransfer.length > 0) {
    tx.transferObjects(coinsToTransfer, senderAddress);
  }

  return tx;
}

/**
 * Build a simulation TX for closing a small position (below min_size):
 * deposit enough to repay debt, repay, then query the resulting state.
 *
 * For long: deposit quote → repayQuote → managerState
 * For short: deposit base → repayBase → managerState
 */
export function buildSmallCloseSimulationTx(
  client: DeepBookClient,
  managerKey: string,
  poolKey: string,
  managerAddress: string,
  side: "long" | "short",
  depositAmount: number
): Transaction {
  const tx = new Transaction();

  if (side === "long") {
    // Long debt is in quote — deposit quote to cover debt, then repay
    client.marginManager.depositQuote({ managerKey, amount: depositAmount })(tx);
    client.marginManager.repayQuote(managerKey)(tx);
  } else {
    // Short debt is in base — deposit base to cover debt, then repay
    client.marginManager.depositBase({ managerKey, amount: depositAmount })(tx);
    client.marginManager.repayBase(managerKey)(tx);
  }

  // Query resulting state (cmd index 2)
  client.marginManager.managerState(poolKey, managerAddress)(tx);

  return tx;
}

/**
 * Build a single TX to close a small position (below pool min_size):
 * deposit → repay → withdraw all → transfer to sender.
 *
 * No market order needed — we deposit enough from the user's wallet to repay
 * the debt directly, then withdraw everything that's left.
 */
export function buildSmallPositionCloseTx(
  client: DeepBookClient,
  managerKey: string,
  side: "long" | "short",
  depositAmount: number,
  withdrawBaseAmount: number,
  withdrawQuoteAmount: number,
  senderAddress: string
): Transaction {
  const tx = new Transaction();

  // Step 1: Deposit enough to cover debt
  if (side === "long") {
    client.marginManager.depositQuote({ managerKey, amount: depositAmount })(tx);
    client.marginManager.repayQuote(managerKey)(tx);
  } else {
    client.marginManager.depositBase({ managerKey, amount: depositAmount })(tx);
    client.marginManager.repayBase(managerKey)(tx);
  }

  // Step 2: Withdraw all remaining assets
  const coinsToTransfer: any[] = [];
  if (withdrawBaseAmount > 0) {
    const baseCoin = client.marginManager.withdrawBase(managerKey, withdrawBaseAmount)(tx);
    coinsToTransfer.push(baseCoin);
  }
  if (withdrawQuoteAmount > 0) {
    const quoteCoin = client.marginManager.withdrawQuote(managerKey, withdrawQuoteAmount)(tx);
    coinsToTransfer.push(quoteCoin);
  }

  // Step 3: Transfer to sender
  if (coinsToTransfer.length > 0) {
    tx.transferObjects(coinsToTransfer, senderAddress);
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

const FLOAT_SCALAR = 1e9;

/** Decode BCS u64 from base64 string, Uint8Array, or indexed object {0:n, 1:n, ...} */
function decodeBcsU64(value: string | Uint8Array | Record<string, number>): bigint {
  let bytes: Uint8Array;
  if (typeof value === "string") {
    bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } else if (value instanceof Uint8Array) {
    bytes = value;
  } else {
    // Object like {0: 96, 1: 191, ...} from simulation result
    const len = Object.keys(value).length;
    bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = value[i];
  }
  const parsed = bcs.u64().parse(bytes);
  return typeof parsed === "string" ? BigInt(parsed) : BigInt(parsed);
}

export type MarginPoolState = {
  totalSupply: number;
  totalBorrow: number;
  maxUtilizationRate: number;
  available: number; // totalSupply * maxUtilizationRate - totalBorrow
  coinKey: string;
};

/**
 * Query a margin pool's liquidity state (totalSupply, totalBorrow, maxUtilizationRate)
 * via a single simulation with 3 moveCall commands.
 */
export async function queryMarginPoolState(
  client: DeepBookClient,
  suiClient: any,
  senderAddress: string,
  coinKey: string
): Promise<MarginPoolState> {
  const coinConfig = (coins.coins as Record<string, { decimals: number }>)[coinKey];
  const scalar = Math.pow(10, coinConfig?.decimals ?? 6);

  const tx = new Transaction();
  tx.setSender(senderAddress);

  // cmd 0: totalSupply
  client.marginPool.totalSupply(coinKey)(tx);
  // cmd 1: totalBorrow
  client.marginPool.totalBorrow(coinKey)(tx);
  // cmd 2: maxUtilizationRate
  client.marginPool.maxUtilizationRate(coinKey)(tx);

  const simResult = await suiClient.core.simulateTransaction({
    transaction: tx,
    include: { commandResults: true },
  });

  if (simResult.$kind === "FailedTransaction") {
    throw new Error(`Pool state query failed: ${JSON.stringify(simResult.FailedTransaction)}`);
  }

  // commandResults is a top-level key on simResult (not nested inside .Transaction)
  const cmds = (simResult as any).commandResults;
  if (!cmds || cmds.length < 3) {
    console.error("[queryMarginPoolState] Unexpected simResult:", JSON.stringify(simResult, null, 2).slice(0, 2000));
    throw new Error(`Unexpected simulation result: cmdsLen=${cmds?.length}`);
  }

  const totalSupplyRaw = Number(decodeBcsU64(cmds[0].returnValues[0].bcs));
  const totalBorrowRaw = Number(decodeBcsU64(cmds[1].returnValues[0].bcs));
  const maxUtilRaw = Number(decodeBcsU64(cmds[2].returnValues[0].bcs));

  const totalSupply = totalSupplyRaw / scalar;
  const totalBorrow = totalBorrowRaw / scalar;
  const maxUtilizationRate = maxUtilRaw / FLOAT_SCALAR;
  const available = totalSupply * maxUtilizationRate - totalBorrow;

  return { totalSupply, totalBorrow, maxUtilizationRate, available, coinKey };
}

/**
 * Build a PTB that mints a SupplierCap and supplies liquidity to a margin pool.
 * Combines both steps in a single transaction.
 */
export function buildSupplyToPoolTx(
  client: DeepBookClient,
  coinKey: string,
  amount: number
): Transaction {
  const tx = new Transaction();

  // Step 1: Mint a SupplierCap
  const supplierCap = client.marginPool.mintSupplierCap()(tx);

  // Step 2: Supply to the margin pool (positional args: coinKey, supplierCap, amount)
  client.marginPool.supplyToMarginPool(coinKey, supplierCap, amount)(tx);

  return tx;
}

/**
 * Query current base/quote balances and debts of a margin manager.
 * Used to get accurate balances after a close/repay before withdrawing.
 */
export async function queryManagerBalances(
  client: DeepBookClient,
  suiClient: any,
  senderAddress: string,
  poolKey: string,
  managerAddress: string,
  baseSymbol: string,
  quoteSymbol: string
): Promise<{ baseAsset: number; quoteAsset: number; baseDebt: number; quoteDebt: number }> {
  const coinConfig = coins.coins as Record<string, { decimals: number }>;
  const baseScalar = Math.pow(10, coinConfig[baseSymbol]?.decimals ?? 9);
  const quoteScalar = Math.pow(10, coinConfig[quoteSymbol]?.decimals ?? 6);

  const tx = new Transaction();
  tx.setSender(senderAddress);

  client.marginManager.managerState(poolKey, managerAddress)(tx);

  const simResult = await suiClient.core.simulateTransaction({
    transaction: tx,
    include: { commandResults: true },
  });

  if (simResult.$kind === "FailedTransaction") {
    throw new Error(`managerState query failed: ${JSON.stringify(simResult.FailedTransaction)}`);
  }

  const returnValues = (simResult as any).commandResults?.[0]?.returnValues;
  if (!returnValues || returnValues.length < 7) {
    throw new Error(`Unexpected returnValues length: ${returnValues?.length}`);
  }

  const baseAssetRaw = Number(decodeBcsU64(returnValues[3].bcs));
  const quoteAssetRaw = Number(decodeBcsU64(returnValues[4].bcs));
  const baseDebtRaw = Number(decodeBcsU64(returnValues[5].bcs));
  const quoteDebtRaw = Number(decodeBcsU64(returnValues[6].bcs));

  return {
    baseAsset: baseAssetRaw / baseScalar,
    quoteAsset: quoteAssetRaw / quoteScalar,
    baseDebt: baseDebtRaw / baseScalar,
    quoteDebt: quoteDebtRaw / quoteScalar,
  };
}
