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
import { ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { calculateModifiedRiskRatio, getRiskColor, getRiskLabel } from "@/lib/risk";
import { usePrices } from "@/hooks/use-prices";
import Link from "next/link";

const mockPositions = [
  {
    id: "1",
    pool: "SUI / USDC",
    poolId: "SUI_USDC",
    baseSymbol: "SUI",
    quoteSymbol: "USDC",
    side: "Long" as const,
    collateral: 500,
    collateralAsset: "USDC",
    leverage: 3,
    currentPrice: 3.45,
    liqPrice: 2.28,
    risk: 1.2,
    debt: 1000,
    debtAsset: "USDC",
    interestRate: 0.085,
    // On-chain MarginManager object ID (from newMarginManager tx)
    managerAddress: "0xabc123...",
  },
  {
    id: "2",
    pool: "DEEP / SUI",
    poolId: "DEEP_SUI",
    baseSymbol: "DEEP",
    quoteSymbol: "SUI",
    side: "Short" as const,
    collateral: 250,
    collateralAsset: "SUI",
    leverage: 2,
    currentPrice: 0.042,
    liqPrice: 0.063,
    risk: 0.8,
    debt: 5952,
    debtAsset: "DEEP",
    interestRate: 0.12,
    managerAddress: "0xdef456...",
  },
];

type PositionType = (typeof mockPositions)[number];

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
          }: {
            position: PositionType;
            collateralPrice: number;
          }) {
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

            const newRisk =
              amountNum > 0
                ? calculateModifiedRiskRatio(
                    position.collateral,
                    delta,
                    collateralPrice,
                    position.risk
                  )
                : position.risk;

            const handleModify = async () => {
              if (!account?.address || !suiClient) {
                setTxStatus("Connect wallet first");
                return;
              }
              if (amountNum <= 0) return;

              setIsSubmitting(true);
              setTxStatus(null);

              try {
                // Create client with the position's margin manager configured
                const managerKey = position.poolId;
                const client = createClientWithManagers(
                  suiClient,
                  account.address,
                  {
                    [managerKey]: {
                      address: position.managerAddress,
                      poolKey: position.poolId,
                    },
                  }
                );

                let tx;

                if (action === "deposit") {
                  tx = buildDepositTx(
                    client,
                    managerKey,
                    position.baseSymbol,
                    position.quoteSymbol,
                    position.collateralAsset,
                    amountNum
                  );
                } else {
                  tx = buildWithdrawTx(
                    client,
                    managerKey,
                    position.baseSymbol,
                    position.collateralAsset,
                    amountNum
                  );
                }

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: tx,
                });

                setTxStatus(
                  action === "deposit"
                    ? "Collateral added!"
                    : "Collateral withdrawn!"
                );
                setAmount("");
              } catch (err: any) {
                console.error("Modify collateral failed:", err);
                setTxStatus(formatTxError(err));
              } finally {
                setIsSubmitting(false);
              }
            };

            return (
              <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setTxStatus(null); setAmount(""); } }}>
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
                      <h3 className="font-semibold text-sm">
                        Modify Collateral
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {position.pool} — {position.side} {position.leverage}x
                      </p>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Current Collateral
                      </span>
                      <span className="font-mono font-medium flex items-center gap-1.5">
                        <CoinIcon
                          symbol={position.collateralAsset}
                          size={14}
                        />
                        {position.collateral.toLocaleString()}{" "}
                        {position.collateralAsset}
                      </span>
                    </div>

                    <Separator />

                    <Tabs value={action} onValueChange={setAction}>
                      <TabsList className="w-full">
                        <TabsTrigger
                          value="deposit"
                          className={`flex-1 ${
                            action === "deposit"
                              ? "!bg-emerald-500/20 !text-emerald-500"
                              : ""
                          }`}
                        >
                          Add
                        </TabsTrigger>
                        <TabsTrigger
                          value="withdraw"
                          className={`flex-1 ${
                            action === "withdraw"
                              ? "!bg-rose-500/20 !text-rose-500"
                              : ""
                          }`}
                        >
                          Withdraw
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="space-y-2">
                      <Label className="text-xs">
                        Amount ({position.collateralAsset})
                      </Label>
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
                          <span className="text-muted-foreground">
                            Risk Ratio
                          </span>
                          <div className="flex items-center gap-1.5 font-mono font-medium">
                            <span className={getRiskColor(position.risk)}>
                              {position.risk.toFixed(2)}
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
                            <span className={getRiskColor(position.risk)}>
                              {getRiskLabel(position.risk)}
                            </span>
                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                            <span className={getRiskColor(newRisk)}>
                              {getRiskLabel(newRisk)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status message */}
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
                          {action === "deposit"
                            ? "Depositing..."
                            : "Withdrawing..."}
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

/**
 * ClosePopover — confirmation + real SDK close position flow.
 */
const ClosePopover = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) =>
      import("@/lib/deepbook/transactions").then((txMod) => {
          const { useCurrentAccount, useCurrentClient, useDAppKit } = dappKit;
          const {
            buildClosePositionTx,
            buildWithdrawAllCollateralTx,
            createClientWithManagers,
            formatTxError,
            isUserRejection,
          } = txMod;

          return function ClosePopoverInner({
            position,
          }: {
            position: PositionType;
          }) {
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
                const managerKey = position.poolId;
                const client = createClientWithManagers(
                  suiClient,
                  account.address,
                  {
                    [managerKey]: {
                      address: position.managerAddress,
                      poolKey: position.poolId,
                    },
                  }
                );

                // Step 1: Close order + settle + repay debt
                setTxStage({ step: 1, total: 2, label: "Closing position & repaying debt" });

                // Order quantity = collateral * leverage in base asset terms
                // For simplicity, use collateral * leverage / current price for the order size
                const orderQuantity =
                  position.side === "Long"
                    ? (position.collateral * position.leverage) /
                      position.currentPrice
                    : position.collateral * position.leverage;

                const closeTx = buildClosePositionTx(
                  client,
                  managerKey,
                  position.poolId,
                  position.side === "Long" ? "long" : "short",
                  orderQuantity,
                  position.collateralAsset === "DEEP"
                );

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: closeTx,
                });

                // Step 2: Withdraw remaining collateral
                setTxStage({ step: 2, total: 2, label: "Withdrawing collateral" });

                const withdrawTx = buildWithdrawAllCollateralTx(
                  client,
                  managerKey,
                  position.baseSymbol,
                  position.collateralAsset,
                  position.collateral
                );

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: withdrawTx,
                });

                setTxStage(null);
                setTxStatus("Position closed!");
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
              <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setTxStatus(null); setTxStage(null); } }}>
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
                        {position.pool} — {position.side} {position.leverage}x
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Collateral</span>
                        <span className="font-mono font-medium flex items-center gap-1.5">
                          <CoinIcon symbol={position.collateralAsset} size={14} />
                          {position.collateral.toLocaleString()} {position.collateralAsset}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Debt</span>
                        <span className="font-mono font-medium flex items-center gap-1.5">
                          <CoinIcon symbol={position.debtAsset} size={14} />
                          {position.debt.toLocaleString()} {position.debtAsset}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2.5">
                      <p className="text-xs text-rose-400">
                        This will close your position at market price, repay all debt, and withdraw remaining collateral.
                      </p>
                    </div>

                    {/* Stage progress */}
                    {isSubmitting && txStage && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Step {txStage.step} of {txStage.total}
                          </span>
                          <span className="text-foreground font-medium">{txStage.label}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-500 transition-all duration-500"
                            style={{ width: `${(txStage.step / txStage.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

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
  const { getUsdPrice } = usePrices();
  const totalCollateral = mockPositions.reduce(
    (acc, p) => acc + p.collateral * getUsdPrice(p.collateralAsset),
    0
  );

  return (
    <div className="min-h-screen bg-background relative">
      <FloatingIcons />
      <SimpleHeader />

      <main className="relative z-10 max-w-5xl mx-auto px-8 lg:px-16 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Manage your positions</p>
        </div>

        {/* Stats */}
        <SpotlightCard className="mb-8 p-6">
          <p className="text-sm text-muted-foreground">Total Collateral</p>
          <p className="text-3xl font-bold text-primary">
            ${totalCollateral.toFixed(2).toLocaleString()}
          </p>
        </SpotlightCard>

        {/* Positions */}
        <SpotlightCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <PulseDot />
            <span className="text-sm font-medium">Open Positions</span>
          </div>

          {mockPositions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No open positions</p>
              <Button className="mt-4" asChild>
                <Link href="/">Open a trade</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {mockPositions.map((position) => (
                <div
                  key={position.id}
                  className="border rounded-lg p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          position.side === "Long"
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-rose-500/20 text-rose-500"
                        }`}
                      >
                        {position.side}
                      </span>
                      <PoolPairIcon
                        baseSymbol={position.baseSymbol}
                        quoteSymbol={position.quoteSymbol}
                        size={18}
                      />
                      <span className="font-medium">{position.pool}</span>
                      <span className="text-primary text-sm font-medium">
                        {position.leverage}x
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ModifyPopover
                        position={position}
                        collateralPrice={getUsdPrice(position.collateralAsset)}
                      />
                      <ClosePopover position={position} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Collateral</p>
                      <p className="font-mono font-medium flex items-center gap-1.5">
                        <CoinIcon
                          symbol={position.collateralAsset}
                          size={14}
                        />
                        {position.collateral.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Debt</p>
                      <p className="font-mono font-medium flex items-center gap-1.5">
                        <CoinIcon symbol={position.debtAsset} size={14} />
                        {position.debt.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current Price</p>
                      <p className="font-mono font-medium">
                        ${position.currentPrice.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Liq. Price</p>
                      <p className="font-mono font-medium">
                        ${position.liqPrice.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interest Rate</p>
                      <p className="font-mono font-medium">
                        {(position.interestRate * 100).toFixed(1)}%
                        <span className="text-muted-foreground text-xs ml-0.5">
                          APR
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk Ratio</p>
                      <p
                        className={`font-mono font-medium ${getRiskColor(position.risk)}`}
                      >
                        {position.risk.toFixed(2)} (
                        {getRiskLabel(position.risk)})
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SpotlightCard>
      </main>
    </div>
  );
}
