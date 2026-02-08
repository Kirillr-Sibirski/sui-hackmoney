"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SimpleHeader } from "@/components/layout/SimpleHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FloatingIcons } from "@/components/ui/floating-icons";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { PulseDot } from "@/components/ui/pulse-dot";
import { PoolPairIcon, CoinIcon } from "@/components/ui/coin-icon";
import { ArrowRight, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { calculateModifiedRiskRatio, getRiskColor, getRiskLabel, getLiquidationRiskRatio } from "@/lib/risk";
import { removePosition } from "@/lib/positions";
import { usePrices } from "@/hooks/use-prices";
import Link from "next/link";
import type { OnChainPosition } from "@/hooks/use-positions";

/**
 * Dashboard inner component — loaded dynamically for dapp-kit hooks.
 */
const DashboardInner = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) =>
      import("@/hooks/use-positions").then((posHook) =>
        import("@/hooks/use-interest-rates").then((irMod) => {
          const { useCurrentAccount, useCurrentClient } = dappKit;
          const { usePositions } = posHook;
          const { useInterestRates } = irMod;

          return function DashboardWithWallet() {
            const account = useCurrentAccount();
            const suiClient = useCurrentClient();
            const { getUsdPrice } = usePrices();
            const { positions, isLoading, refresh } = usePositions(
              suiClient,
              account?.address
            );
            const { rates: interestRates } = useInterestRates(suiClient, account?.address);

            const totalEquityUsd = positions.reduce((acc, p) => {
              const baseUsd = p.baseAsset * getUsdPrice(p.baseSymbol);
              const quoteUsd = p.quoteAsset * getUsdPrice(p.quoteSymbol);
              const debtAmount = p.quoteDebt > 0 ? p.quoteDebt : p.baseDebt;
              const debtAsset = p.quoteDebt > 0 ? p.quoteSymbol : p.baseSymbol;
              const debtUsd = debtAmount * getUsdPrice(debtAsset);
              return acc + baseUsd + quoteUsd - debtUsd;
            }, 0);

            return (
              <main className="relative z-10 max-w-5xl mx-auto px-8 lg:px-16 py-8">
                <div className="mb-8">
                  <h1 className="text-2xl font-bold">Dashboard</h1>
                  <p className="text-muted-foreground">Manage your positions</p>
                </div>

                {/* Stats */}
                <SpotlightCard className="mb-8 p-6">
                  <p className="text-sm text-muted-foreground">Total Collateral</p>
                  <p className="text-3xl font-bold text-primary">
                    ${totalEquityUsd.toFixed(2)}
                  </p>
                </SpotlightCard>

                {/* Positions */}
                <SpotlightCard className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <PulseDot />
                      <span className="text-sm font-medium">Open Positions</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refresh}
                      disabled={isLoading}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>

                  {!account ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Connect your wallet to view positions</p>
                    </div>
                  ) : isLoading ? (
                    <div className="space-y-4">
                      {[...Array(2)].map((_, i) => (
                        <div
                          key={i}
                          className="border rounded-lg p-4 animate-pulse"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="h-6 w-12 rounded bg-muted/50" />
                            <div className="h-5 w-24 rounded bg-muted/50" />
                          </div>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                            {[...Array(6)].map((_, j) => (
                              <div key={j}>
                                <div className="h-3 w-16 rounded bg-muted/50 mb-2" />
                                <div className="h-4 w-20 rounded bg-muted/50" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : positions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No open positions</p>
                      <Button className="mt-4" asChild>
                        <Link href="/">Open a trade</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {positions.map((position) => {
                        const debtAsset = position.quoteDebt > 0 ? position.quoteSymbol : position.baseSymbol;
                        const debtAmount = position.quoteDebt > 0 ? position.quoteDebt : position.baseDebt;
                        const borrowRate = interestRates[debtAsset] ?? 0;
                        const collateralUsd =
                          position.baseAsset * getUsdPrice(position.baseSymbol) +
                          position.quoteAsset * getUsdPrice(position.quoteSymbol);
                        const debtUsd = debtAmount * getUsdPrice(debtAsset);
                        const basePrice = getUsdPrice(position.baseSymbol);
                        const liqRiskRatio = getLiquidationRiskRatio(position.poolKey);
                        const hasDebt = debtAmount > 0.0001;

                        // Compute liquidation price
                        let liqPrice = 0;
                        if (debtUsd > 0 && collateralUsd > 0) {
                          const liqFactor = (liqRiskRatio * debtUsd) / (collateralUsd + debtUsd);
                          liqPrice =
                            position.side === "long"
                              ? basePrice * liqFactor
                              : basePrice * (2 - liqFactor);
                        }

                        // Derive leverage from on-chain risk ratio (uses Pyth oracle prices)
                        // riskRatio = totalAssets / totalDebt, leverage = R / (R - 1)
                        const leverage = position.riskRatio > 1 && hasDebt
                          ? position.riskRatio / (position.riskRatio - 1)
                          : 1;

                        // Position size display: total assets in manager
                        const positionDisplay =
                          position.baseAsset > 0
                            ? { amount: position.baseAsset, symbol: position.baseSymbol }
                            : { amount: position.quoteAsset, symbol: position.quoteSymbol };

                        // Collateral (equity) = total assets - debt, in the original collateral asset
                        // Long → collateral asset is quote (e.g. USDC), Short → collateral asset is base
                        const collateralAssetSymbol = position.collateralAsset;
                        const collateralAssetPrice = getUsdPrice(collateralAssetSymbol);
                        const equityUsd = collateralUsd - debtUsd;
                        const equityInCollateralAsset = collateralAssetPrice > 0 ? equityUsd / collateralAssetPrice : 0;

                        return (
                          <div
                            key={position.managerAddress}
                            className="border rounded-lg p-4 hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    position.side === "long"
                                      ? "bg-emerald-500/20 text-emerald-500"
                                      : "bg-rose-500/20 text-rose-500"
                                  }`}
                                >
                                  {position.side === "long" ? "Long" : "Short"}
                                </span>
                                <PoolPairIcon
                                  baseSymbol={position.baseSymbol}
                                  quoteSymbol={position.quoteSymbol}
                                  size={18}
                                />
                                <span className="font-medium">{position.pool}</span>
                                {hasDebt && (
                                  <span className="text-primary text-sm font-medium">
                                    {leverage.toFixed(1)}x
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <ModifyPopover
                                  position={position}
                                  collateralPrice={collateralAssetPrice}
                                  collateralDisplay={{ amount: equityInCollateralAsset, symbol: collateralAssetSymbol }}
                                  onSuccess={refresh}
                                />
                                <ClosePopover
                                  position={position}
                                  collateralDisplay={positionDisplay}
                                  debtAmount={debtAmount}
                                  debtAsset={debtAsset}
                                  leverage={leverage}
                                  onSuccess={refresh}
                                />
                              </div>
                            </div>

                            <div className={`grid gap-4 text-sm ${hasDebt ? "grid-cols-3 md:grid-cols-6" : "grid-cols-2 md:grid-cols-3"}`}>
                              <div>
                                <p className="text-muted-foreground">Collateral</p>
                                <p className="font-mono font-medium flex items-center gap-1.5">
                                  <CoinIcon symbol={collateralAssetSymbol} size={14} />
                                  {equityInCollateralAsset < 0.01
                                    ? equityInCollateralAsset.toPrecision(3)
                                    : equityInCollateralAsset < 1
                                      ? equityInCollateralAsset.toFixed(4)
                                      : equityInCollateralAsset.toFixed(2)}{" "}
                                  <span className="text-muted-foreground text-xs">{collateralAssetSymbol}</span>
                                </p>
                              </div>
                              {hasDebt && (
                                <div>
                                  <p className="text-muted-foreground">Debt</p>
                                  <p className="font-mono font-medium flex items-center gap-1.5">
                                    <CoinIcon symbol={debtAsset} size={14} />
                                    {debtAmount < 0.01
                                      ? debtAmount.toPrecision(3)
                                      : debtAmount < 1
                                        ? debtAmount.toFixed(4)
                                        : debtAmount.toFixed(2)}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-muted-foreground">Current Price</p>
                                <p className="font-mono font-medium">
                                  ${basePrice < 0.01
                                    ? basePrice.toPrecision(3)
                                    : basePrice.toFixed(4)}
                                </p>
                              </div>
                              {hasDebt && (
                                <>
                                  <div>
                                    <p className="text-muted-foreground">Liq. Price</p>
                                    <p className="font-mono font-medium">
                                      ${liqPrice < 0.01
                                        ? liqPrice.toPrecision(3)
                                        : liqPrice.toFixed(4)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Interest Rate</p>
                                    <p className="font-mono font-medium">
                                      {borrowRate > 0
                                        ? `${(borrowRate * 100).toFixed(1)}%`
                                        : "—"}
                                      {borrowRate > 0 && (
                                        <span className="text-muted-foreground text-xs ml-0.5">APR</span>
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Risk Ratio</p>
                                    <p
                                      className={`font-mono font-medium ${getRiskColor(position.riskRatio)}`}
                                    >
                                      {position.riskRatio === Infinity
                                        ? "∞"
                                        : position.riskRatio.toFixed(2)}{" "}
                                      ({getRiskLabel(position.riskRatio)})
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SpotlightCard>
              </main>
            );
          };
        })
      )
    ),
  {
    ssr: false,
    loading: () => (
      <main className="relative z-10 max-w-5xl mx-auto px-8 lg:px-16 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Manage your positions</p>
        </div>
        <SpotlightCard className="mb-8 p-6">
          <div className="h-5 w-32 rounded bg-muted/50 animate-pulse mb-2" />
          <div className="h-9 w-40 rounded bg-muted/50 animate-pulse" />
        </SpotlightCard>
        <SpotlightCard className="p-6">
          <div className="h-5 w-32 rounded bg-muted/50 animate-pulse mb-6" />
          <div className="h-24 rounded bg-muted/50 animate-pulse" />
        </SpotlightCard>
      </main>
    ),
  }
);

type ModifyProps = {
  position: OnChainPosition;
  collateralPrice: number;
  collateralDisplay: { amount: number; symbol: string };
  onSuccess: () => void;
};

/**
 * ModifyPopover with real SDK calls — loaded dynamically to access dapp-kit hooks.
 */
const ModifyPopover = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) =>
      import("@/lib/deepbook/transactions").then((txMod) => {
        const { useCurrentAccount, useCurrentClient, useDAppKit } = dappKit;
        const { buildDepositTx, buildWithdrawTx, createClientWithManagers, formatTxError } = txMod;

        return function ModifyPopoverInner({
          position,
          collateralPrice,
          collateralDisplay,
          onSuccess,
        }: ModifyProps) {
          const account = useCurrentAccount();
          const suiClient = useCurrentClient();
          const dAppKitInstance = useDAppKit();

          const [action, setAction] = useState("deposit");
          const [amount, setAmount] = useState("");
          const [isSubmitting, setIsSubmitting] = useState(false);
          const [txStatus, setTxStatus] = useState<string | null>(null);
          const [open, setOpen] = useState(false);

          const amountNum = parseFloat(amount) || 0;
          const delta = action === "deposit" ? amountNum : -amountNum;

          // Compute new risk ratio preview
          const currentRisk = position.riskRatio;
          const newRisk =
            amountNum > 0
              ? calculateModifiedRiskRatio(
                  collateralDisplay.amount,
                  delta,
                  collateralPrice,
                  currentRisk
                )
              : currentRisk;

          const handleModify = async () => {
            if (!account?.address || !suiClient) {
              setTxStatus("Connect wallet first");
              return;
            }
            if (amountNum <= 0) return;

            setIsSubmitting(true);
            setTxStatus(null);

            try {
              const managerKey = position.poolKey;
              const client = createClientWithManagers(suiClient, account.address, {
                [managerKey]: {
                  address: position.managerAddress,
                  poolKey: position.poolKey,
                },
              });

              let tx;
              if (action === "deposit") {
                tx = buildDepositTx(
                  client,
                  managerKey,
                  position.baseSymbol,
                  position.quoteSymbol,
                  collateralDisplay.symbol,
                  amountNum
                );
              } else {
                tx = buildWithdrawTx(
                  client,
                  managerKey,
                  position.baseSymbol,
                  collateralDisplay.symbol,
                  amountNum,
                  account.address
                );
              }

              await dAppKitInstance.signAndExecuteTransaction({ transaction: tx });

              setTxStatus(action === "deposit" ? "Collateral added!" : "Collateral withdrawn!");
              setAmount("");
              onSuccess();
            } catch (err: any) {
              console.error("Modify collateral failed:", err);
              setTxStatus(formatTxError(err));
            } finally {
              setIsSubmitting(false);
            }
          };

          return (
            <Popover
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) { setTxStatus(null); setAmount(""); }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  className="bg-blue-500/15 text-blue-500 border border-blue-500/30 hover:bg-blue-500/25 hover:text-blue-400"
                >
                  Modify
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm">Modify Collateral</h3>
                    <p className="text-xs text-muted-foreground">
                      {position.pool} — {position.side === "long" ? "Long" : "Short"}
                    </p>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Collateral</span>
                    <span className="font-mono font-medium flex items-center gap-1.5">
                      <CoinIcon symbol={collateralDisplay.symbol} size={14} />
                      {collateralDisplay.amount < 1
                        ? collateralDisplay.amount.toFixed(4)
                        : collateralDisplay.amount.toFixed(2)}{" "}
                      {collateralDisplay.symbol}
                    </span>
                  </div>

                  <Separator />

                  <Tabs value={action} onValueChange={setAction}>
                    <TabsList className="w-full">
                      <TabsTrigger
                        value="deposit"
                        className={`flex-1 ${action === "deposit" ? "!bg-emerald-500/20 !text-emerald-500" : ""}`}
                      >
                        Add
                      </TabsTrigger>
                      <TabsTrigger
                        value="withdraw"
                        className={`flex-1 ${action === "withdraw" ? "!bg-rose-500/20 !text-rose-500" : ""}`}
                      >
                        Withdraw
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="space-y-2">
                    <Label className="text-xs">Amount ({collateralDisplay.symbol})</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  {amountNum > 0 && (
                    <div className="rounded-md bg-muted/50 px-3 py-2.5 space-y-1">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-muted-foreground">Risk Ratio</span>
                        <div className="flex items-center gap-1.5 font-mono font-medium">
                          <span className={getRiskColor(currentRisk)}>
                            {currentRisk.toFixed(2)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className={getRiskColor(newRisk)}>
                            {newRisk.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-muted-foreground">Safety</span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className={getRiskColor(currentRisk)}>
                            {getRiskLabel(currentRisk)}
                          </span>
                          <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className={getRiskColor(newRisk)}>
                            {getRiskLabel(newRisk)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {txStatus && (
                    <p
                      className={`text-xs text-center ${
                        txStatus.startsWith("Error")
                          ? "text-rose-500"
                          : txStatus === "Transaction cancelled"
                            ? "text-muted-foreground"
                            : "text-emerald-500"
                      }`}
                    >
                      {txStatus}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isSubmitting || amountNum <= 0 || !account}
                    onClick={handleModify}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {action === "deposit" ? "Depositing..." : "Withdrawing..."}
                      </>
                    ) : !account ? (
                      "Connect Wallet"
                    ) : action === "deposit" ? (
                      "Add Collateral"
                    ) : (
                      "Withdraw Collateral"
                    )}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        };
      })
    ),
  {
    ssr: false,
    loading: () => (
      <Button
        size="sm"
        className="bg-blue-500/15 text-blue-500 border border-blue-500/30"
        disabled
      >
        Modify
      </Button>
    ),
  }
);

type CloseProps = {
  position: OnChainPosition;
  collateralDisplay: { amount: number; symbol: string };
  debtAmount: number;
  debtAsset: string;
  leverage: number;
  onSuccess: () => void;
};

/**
 * ClosePopover — confirmation + real SDK close position flow.
 */
const ClosePopover = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) =>
      import("@/lib/deepbook/transactions").then((txMod) => {
        const { useCurrentAccount, useCurrentClient, useDAppKit } = dappKit;
        const {
          buildCloseSimulationTx,
          buildFullClosePositionTx,
          buildSmallCloseSimulationTx,
          buildSmallPositionCloseTx,
          parsePostCloseBalances,
          buildRepayWithdrawSimulationTx,
          buildRepayWithdrawTx,
          buildWithdrawOnlyTx,
          createClientWithManagers,
          formatTxError,
          isUserRejection,
        } = txMod;

        return function ClosePopoverInner({
          position,
          collateralDisplay,
          debtAmount,
          debtAsset,
          leverage,
          onSuccess,
        }: CloseProps) {
          const account = useCurrentAccount();
          const suiClient = useCurrentClient();
          const dAppKitInstance = useDAppKit();

          const [open, setOpen] = useState(false);
          const [isSubmitting, setIsSubmitting] = useState(false);
          const [txStage, setTxStage] = useState<{ step: number; total: number; label: string } | null>(null);
          const [txStatus, setTxStatus] = useState<string | null>(null);

          const handleClose = async () => {
            if (!account?.address || !suiClient) {
              setTxStatus("Connect wallet first");
              return;
            }

            setIsSubmitting(true);
            setTxStatus(null);

            try {
              const managerKey = position.poolKey;
              const client = createClientWithManagers(suiClient, account.address, {
                [managerKey]: {
                  address: position.managerAddress,
                  poolKey: position.poolKey,
                },
              });

              // Long → sell all base, Short → buy back base debt
              const orderQuantity =
                position.side === "long"
                  ? position.baseAsset
                  : position.baseDebt;

              const hasDebt = position.quoteDebt > 0.0001 || position.baseDebt > 0.0001;
              const hasAssets = position.baseAsset > 0.0001 || position.quoteAsset > 0.0001;

              console.log("[ClosePosition] Position state:", {
                managerKey,
                managerAddress: position.managerAddress,
                side: position.side,
                orderQuantity,
                hasDebt, hasAssets,
                baseAsset: position.baseAsset,
                baseDebt: position.baseDebt,
                quoteAsset: position.quoteAsset,
                quoteDebt: position.quoteDebt,
              });

              if (orderQuantity > 0 && hasDebt) {
                // === LEVERAGED POSITION: sell + settle + repay + withdraw in one TX ===
                setTxStage({ step: 1, total: 1, label: "Closing position & withdrawing funds" });

                // Simulate close to get exact post-close balances
                const simTx = buildCloseSimulationTx(
                  client, managerKey, position.poolKey,
                  position.managerAddress, position.side,
                  orderQuantity, false
                );
                simTx.setSender(account.address);
                const simResult = await suiClient.core.simulateTransaction({
                  transaction: simTx,
                  include: { commandResults: true, effects: true },
                });
                console.log("[ClosePosition] Simulation result:", JSON.stringify(simResult, null, 2).slice(0, 2000));

                if (simResult.$kind === "FailedTransaction") {
                  const errorStr = JSON.stringify(simResult.FailedTransaction);
                  const isBelowMinSize = errorStr.includes('"1"') && errorStr.includes("validate_inputs");

                  if (isBelowMinSize) {
                    // Position too small for market order — close by depositing to repay debt
                    console.log("[ClosePosition] Below min_size, using deposit-to-repay fallback");
                    setTxStage({ step: 1, total: 1, label: "Repaying debt & withdrawing funds" });

                    // Deposit enough of the debt asset to repay (with 1% buffer for interest)
                    const debtAmount = position.side === "long" ? position.quoteDebt : position.baseDebt;
                    const depositAmount = debtAmount * 1.01;

                    // Simulate to get exact post-repay balances (managerState at cmd index 2)
                    const smallSimTx = buildSmallCloseSimulationTx(
                      client, managerKey, position.poolKey,
                      position.managerAddress, position.side, depositAmount
                    );
                    smallSimTx.setSender(account.address);
                    const smallSimResult = await suiClient.core.simulateTransaction({
                      transaction: smallSimTx,
                      include: { commandResults: true, effects: true },
                    });
                    console.log("[ClosePosition] Small close sim:", JSON.stringify(smallSimResult, null, 2).slice(0, 2000));

                    if (smallSimResult.$kind === "FailedTransaction") {
                      throw new Error(`Close position failed: ${JSON.stringify(smallSimResult.FailedTransaction)}`);
                    }

                    const smallCmds = (smallSimResult as any).commandResults;
                    const smallLastIdx = smallCmds.length - 1;
                    const { baseAmount, quoteAmount } = parsePostCloseBalances(
                      smallSimResult, smallLastIdx, position.baseSymbol, position.quoteSymbol
                    );
                    console.log("[ClosePosition] Post-repay balances:", { baseAmount, quoteAmount });

                    const closeTx = buildSmallPositionCloseTx(
                      client, managerKey, position.side,
                      depositAmount,
                      Math.max(0, baseAmount * 0.999),
                      Math.max(0, quoteAmount * 0.999),
                      account.address
                    );

                    await dAppKitInstance.signAndExecuteTransaction({ transaction: closeTx });
                    console.log("[ClosePosition] Small position close complete");
                  } else {
                    console.error("[ClosePosition] Simulation FAILED:", simResult.FailedTransaction);
                    throw new Error(`Close position failed: ${errorStr}`);
                  }
                } else {
                  // Normal close: simulation passed
                  // managerState is the last command (index varies because repay's
                  // tx.object.option() can insert hidden commands that shift indices)
                  const cmds = (simResult as any).commandResults;
                  const lastCmdIndex = cmds.length - 1;
                  const { baseAmount, quoteAmount } = parsePostCloseBalances(
                    simResult, lastCmdIndex, position.baseSymbol, position.quoteSymbol
                  );
                  console.log("[ClosePosition] Post-close balances from sim:", { baseAmount, quoteAmount });

                  // Small buffer (0.1%) to avoid over-withdrawal if price moves slightly
                  const safeBase = Math.max(0, baseAmount * 0.999);
                  const safeQuote = Math.max(0, quoteAmount * 0.999);

                  // Build and execute the full close TX (one wallet prompt)
                  const fullCloseTx = buildFullClosePositionTx(
                    client, managerKey, position.poolKey,
                    position.side, orderQuantity, false,
                    safeBase, safeQuote, account.address
                  );

                  await dAppKitInstance.signAndExecuteTransaction({ transaction: fullCloseTx });
                  console.log("[ClosePosition] Full close complete (single TX)");
                }

              } else if (hasDebt && hasAssets) {
                // === HAS DEBT BUT NOTHING TO SELL: repay from existing assets + withdraw ===
                setTxStage({ step: 1, total: 1, label: "Repaying debt & withdrawing funds" });

                const hasQuoteDebt = position.quoteDebt > 0.0001;
                const hasBaseDebt = position.baseDebt > 0.0001;

                // Simulate repay + managerState to get exact post-repay balances
                const simTx = buildRepayWithdrawSimulationTx(
                  client, managerKey, position.poolKey, position.managerAddress,
                  hasQuoteDebt, hasBaseDebt
                );
                simTx.setSender(account.address);
                const simResult = await suiClient.core.simulateTransaction({
                  transaction: simTx,
                  include: { commandResults: true, effects: true },
                });
                console.log("[ClosePosition] Repay+withdraw sim:", JSON.stringify(simResult, null, 2).slice(0, 2000));

                if (simResult.$kind === "FailedTransaction") {
                  throw new Error(`Close simulation failed: ${JSON.stringify(simResult.FailedTransaction)}`);
                }

                const cmds = (simResult as any).commandResults;
                const lastCmdIndex = cmds.length - 1;
                const { baseAmount, quoteAmount } = parsePostCloseBalances(
                  simResult, lastCmdIndex, position.baseSymbol, position.quoteSymbol
                );
                console.log("[ClosePosition] Post-repay balances:", { baseAmount, quoteAmount });

                const safeBase = Math.max(0, baseAmount * 0.999);
                const safeQuote = Math.max(0, quoteAmount * 0.999);

                const closeTx = buildRepayWithdrawTx(
                  client, managerKey,
                  hasQuoteDebt, hasBaseDebt,
                  safeBase, safeQuote,
                  account.address
                );

                await dAppKitInstance.signAndExecuteTransaction({ transaction: closeTx });
                console.log("[ClosePosition] Repay+withdraw complete");
              } else if (hasAssets) {
                // === TRULY NO DEBT: just withdraw all assets ===
                setTxStage({ step: 1, total: 1, label: "Withdrawing funds" });

                const withdrawTx = buildWithdrawOnlyTx(
                  client, managerKey,
                  position.baseAsset * 0.999,
                  position.quoteAsset * 0.999,
                  account.address
                );

                await dAppKitInstance.signAndExecuteTransaction({ transaction: withdrawTx });
                console.log("[ClosePosition] Withdraw-only complete (no debt)");
              }

              setTxStage(null);
              setTxStatus("Position closed!");

              // Remove from localStorage and refresh
              removePosition(position.managerAddress);
              onSuccess();
            } catch (err: any) {
              console.error("Close position failed:", err);
              setTxStage(null);
              if (isUserRejection(err)) {
                setTxStatus("Transaction cancelled");
              } else {
                setTxStatus(formatTxError(err));
              }
            } finally {
              setIsSubmitting(false);
            }
          };

          return (
            <Popover
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) { setTxStatus(null); setTxStage(null); }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  className="bg-rose-500/15 text-rose-500 border border-rose-500/30 hover:bg-rose-500/25 hover:text-rose-400"
                >
                  Close
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Close Position
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {position.pool} — {position.side === "long" ? "Long" : "Short"} {leverage.toFixed(1)}x
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Collateral</span>
                      <span className="font-mono font-medium flex items-center gap-1.5">
                        <CoinIcon symbol={collateralDisplay.symbol} size={14} />
                        {collateralDisplay.amount < 1
                          ? collateralDisplay.amount.toFixed(4)
                          : collateralDisplay.amount.toFixed(2)}{" "}
                        {collateralDisplay.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Debt</span>
                      <span className="font-mono font-medium flex items-center gap-1.5">
                        <CoinIcon symbol={debtAsset} size={14} />
                        {debtAmount < 1
                          ? debtAmount.toFixed(4)
                          : debtAmount.toFixed(2)}{" "}
                        {debtAsset}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
                    <p className="text-xs text-rose-400">
                      This will close your position at market price, repay all debt, and withdraw remaining collateral.
                    </p>
                  </div>

                  {/* Status message */}
                  {txStatus && !isSubmitting && (
                    <p
                      className={`text-xs text-center ${
                        txStatus.startsWith("Error")
                          ? "text-rose-500"
                          : txStatus === "Transaction cancelled"
                            ? "text-muted-foreground"
                            : "text-emerald-500"
                      }`}
                    >
                      {txStatus}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                    disabled={isSubmitting || !account}
                    onClick={handleClose}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {txStage?.label ?? "Closing..."}
                      </>
                    ) : !account ? (
                      "Connect Wallet"
                    ) : (
                      "Confirm Close Position"
                    )}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        };
      })
    ),
  {
    ssr: false,
    loading: () => (
      <Button
        size="sm"
        className="bg-rose-500/15 text-rose-500 border border-rose-500/30"
        disabled
      >
        Close
      </Button>
    ),
  }
);

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background relative">
      <FloatingIcons />
      <SimpleHeader />
      <DashboardInner />
    </div>
  );
}
