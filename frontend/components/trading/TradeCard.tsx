"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles, Loader2, Info, ExternalLink } from "lucide-react";
import pools from "@/config/pools.json";
import coins from "@/config/coins.json";
import marginPoolsData from "@/config/margin_pools.json";

const marginPoolsConfig = marginPoolsData.marginPools as Record<string, { minBorrow: number }>;
import { CoinIcon, PoolPairIcon } from "@/components/ui/coin-icon";
import {
  getMaxLeverage,
  getMinBorrowRiskRatio,
  getLiquidationRiskRatio,
  getRiskColor,
} from "@/lib/risk";
import { usePrices } from "@/hooks/use-prices";

const coinSymbols = Object.keys(coins.coins) as Array<keyof typeof coins.coins>;
// Mock interest rate (annualized, per pool)
const mockInterestRates: Record<string, number> = {
  SUI_USDC: 0.085,
  DEEP_SUI: 0.12,
  DEEP_USDC: 0.11,
  WAL_USDC: 0.1,
};

/**
 * Inner component loaded dynamically — has access to dapp-kit hooks.
 */
const TradeCardInner = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) =>
      import("@mysten/deepbook-v3").then((deepbookMod) =>
        import("@/lib/deepbook/transactions").then((txMod) => {
          const { useCurrentAccount, useCurrentClient, useDAppKit } = dappKit;
          const { DeepBookClient } = deepbookMod;
          const {
            buildCreateManagerAndDepositTx,
            buildBorrowAndOrderTx,
            extractMarginManagerAddress,
            createClientWithManagers,
            formatTxError,
          } = txMod;

          // MarginManager map: managerKey → { address, poolKey }
          type ManagerEntry = { address: string; poolKey: string };

          return function TradeCardWithWallet() {
            const account = useCurrentAccount();
            const suiClient = useCurrentClient();
            const dAppKitInstance = useDAppKit();

            const [side, setSide] = useState<"long" | "short">("long");
            const [leverage, setLeverage] = useState([2]);
            const [selectedPool, setSelectedPool] = useState(pools.pools[0].id);
            const [amount, setAmount] = useState("");
            const [collateral, setCollateral] = useState("USDC");
            const [collateralAmount, setCollateralAmount] = useState("");

            // Stores all created margin managers: unique key → { address, poolKey }
            const [marginManagers, setMarginManagers] = useState<Record<string, ManagerEntry>>({});
            const [isSubmitting, setIsSubmitting] = useState(false);
            const [txStage, setTxStage] = useState<{ step: number; total: number; label: string } | null>(null);
            const [txStatus, setTxStatus] = useState<string | null>(null);

            const { getUsdPrice, getPairPrice } = usePrices();

            const pool = pools.pools.find((p) => p.id === selectedPool) || pools.pools[0];
            const baseAsset = pool.baseAsset;
            const quoteAsset = pool.quoteAsset;
            const basePrice = getUsdPrice(baseAsset);
            const quotePrice = getUsdPrice(quoteAsset);
            const pairPrice = getPairPrice(baseAsset, quoteAsset);
            const interestRate = mockInterestRates[selectedPool] ?? 0.1;
            const maxLeverage = getMaxLeverage(selectedPool);

            // Each position is fully isolated — new manager per trade

            // Base client (no managers) for creating new managers
            const baseClient = useMemo(() => {
              if (!account?.address || !suiClient) return null;
              try {
                return new DeepBookClient({
                  client: suiClient,
                  network: "mainnet",
                  address: account.address,
                });
              } catch {
                return null;
              }
            }, [account?.address, suiClient]);

            const handleOpenPosition = useCallback(async () => {
              if (!baseClient || !account || !suiClient) {
                setTxStatus("Please connect your wallet first");
                return;
              }

              const amountNum = parseFloat(amount) || 0;
              const collateralNum = parseFloat(collateralAmount) || 0;
              const leverageNum = leverage[0];

              const orderQuantity = amountNum * leverageNum;
              const payWithDeep = collateral === "DEEP";

              // --- All calculations in USD ---
              const collateralAssetPrice = getUsdPrice(collateral);
              const exposureUsd = orderQuantity * basePrice;
              const collateralUsd = collateralNum * collateralAssetPrice;
              const borrowUsdRaw = exposureUsd - collateralUsd;

              // Convert borrow USD back to the actual borrowed asset
              // Long → borrow quote, Short → borrow base
              let borrowAmount: number;
              if (borrowUsdRaw <= 0) {
                borrowAmount = 0; // Fully collateralized, no borrow needed
              } else if (side === "long") {
                borrowAmount = quotePrice > 0 ? borrowUsdRaw / quotePrice : 0;
              } else {
                borrowAmount = basePrice > 0 ? borrowUsdRaw / basePrice : 0;
              }

              console.log("[TradeCard] Position calc (USD):", {
                pool: selectedPool, side, leverage: leverageNum,
                orderQuantity, exposureUsd: exposureUsd.toFixed(4),
                collateral: `${collateralNum} ${collateral} ($${collateralUsd.toFixed(4)})`,
                borrowUsd: borrowUsdRaw.toFixed(4),
                borrowAmount: `${borrowAmount.toFixed(6)} ${side === "long" ? quoteAsset : baseAsset}`,
              });

              console.log("[TradeCard] Open position params:", {
                pool: selectedPool, side, leverage: leverageNum,
                amount: amountNum, collateral: collateralNum, collateralAsset: collateral,
                orderQuantity, borrowAmount, pairPrice, basePrice,
              });

              setIsSubmitting(true);
              setTxStatus(null);

              try {
                // Each trade creates a new isolated margin manager
                const managerKey = `${selectedPool}_${Date.now()}`;

                // === TX1: Create manager + deposit + share ===
                setTxStage({ step: 1, total: 2, label: "Creating manager & depositing" });

                const createTx = buildCreateManagerAndDepositTx(
                  baseClient,
                  selectedPool,
                  collateral,
                  collateralNum
                );

                const signResult = await dAppKitInstance.signAndExecuteTransaction({
                  transaction: createTx,
                });

                // Re-fetch tx with objectTypes to find the created MarginManager address
                const digest = (signResult as any).Transaction?.digest;
                const fullResult = await suiClient.core.getTransaction({
                  digest,
                  include: { effects: true, objectTypes: true },
                });

                const managerAddress = extractMarginManagerAddress(fullResult as any);
                if (!managerAddress) {
                  throw new Error("Failed to extract margin manager address from transaction");
                }
                console.log("Margin manager created:", managerKey, managerAddress);

                const newManagers = {
                  ...marginManagers,
                  [managerKey]: { address: managerAddress, poolKey: selectedPool },
                };
                setMarginManagers(newManagers);

                // === TX2: Borrow + market order ===
                setTxStage({ step: 2, total: 2, label: "Opening position" });

                const clientWithManagers = createClientWithManagers(
                  suiClient,
                  account.address,
                  newManagers
                );

                const orderTx = buildBorrowAndOrderTx(
                  clientWithManagers,
                  managerKey,
                  selectedPool,
                  side,
                  borrowAmount,
                  orderQuantity,
                  payWithDeep
                );

                // Dry run first to get detailed error
                try {
                  orderTx.setSender(account.address);
                  const dryRunResult = await suiClient.core.simulateTransaction({
                    transaction: orderTx,
                    include: { effects: true, events: true },
                  });
                  console.log("[DryRun] Result:", JSON.stringify(dryRunResult, null, 2));
                  if (dryRunResult.$kind === "FailedTransaction") {
                    console.error("[DryRun] FAILED:", dryRunResult.FailedTransaction);
                    throw new Error(`Dry run failed: ${JSON.stringify(dryRunResult.FailedTransaction)}`);
                  }
                } catch (dryErr: any) {
                  console.error("[DryRun] Error:", dryErr);
                  throw dryErr;
                }

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: orderTx,
                });

                setTxStage(null);
                setTxStatus("Position opened successfully!");
                setAmount("");
                setCollateralAmount("");
              } catch (err: any) {
                console.error("Transaction failed:", err);
                setTxStage(null);
                setTxStatus(formatTxError(err));
              } finally {
                setIsSubmitting(false);
              }
            }, [
              baseClient,
              account,
              suiClient,
              marginManagers,
              selectedPool,
              side,
              amount,
              leverage,
              collateral,
              collateralAmount,
              baseAsset,
              quoteAsset,
              basePrice,
              quotePrice,
              getUsdPrice,
              dAppKitInstance,
            ]);

            const amountNum = parseFloat(amount) || 0;
            const collateralNum = parseFloat(collateralAmount) || 0;
            const leverageNum = leverage[0];

            const collateralOptions = useMemo(() => {
              const seen = new Set<string>();
              const opts: { symbol: string; cheaper: boolean }[] = [];
              for (const s of [quoteAsset, baseAsset]) {
                if (!seen.has(s) && coinSymbols.includes(s as keyof typeof coins.coins)) {
                  seen.add(s);
                  opts.push({ symbol: s, cheaper: false });
                }
              }
              if (!seen.has("DEEP")) {
                opts.push({ symbol: "DEEP", cheaper: true });
              }
              return opts;
            }, [baseAsset, quoteAsset]);

            // Auto-select a valid collateral when switching pools
            useEffect(() => {
              const validSymbols = collateralOptions.map((o) => o.symbol);
              if (!validSymbols.includes(collateral)) {
                setCollateral(validSymbols[0]);
              }
            }, [collateralOptions, collateral]);

            const isDeepSelected = collateral === "DEEP";

            // --- All display calculations in USD ---
            const collateralPrice = getUsdPrice(collateral);
            const displayExposureUsd = amountNum * basePrice * leverageNum;
            const displayCollateralUsd = collateralNum * collateralPrice;
            const displayBorrowUsd = Math.max(0, displayExposureUsd - displayCollateralUsd);

            // Min collateral: risk = E / (E - C) >= R → C >= E * (1 - 1/R)
            // Only depends on exposure, so it stays stable as user types collateral
            const minBorrowRatio = getMinBorrowRiskRatio(selectedPool);
            const minCollateralUsd = displayExposureUsd * (1 - 1 / minBorrowRatio);
            const minCollateralAmount = collateralPrice > 0 ? minCollateralUsd / collateralPrice : 0;
            const isBelowMin = collateralNum > 0 && collateralNum < minCollateralAmount;

            // Min borrow check: the borrowed asset's margin pool has a minBorrow
            const borrowedAsset = side === "long" ? quoteAsset : baseAsset;
            const borrowedAssetPrice = getUsdPrice(borrowedAsset);
            const minBorrowForAsset = marginPoolsConfig[borrowedAsset]?.minBorrow ?? 0;
            const estimatedBorrowAmount = borrowedAssetPrice > 0 ? displayBorrowUsd / borrowedAssetPrice : 0;
            const isBelowMinBorrow = displayBorrowUsd > 0 && estimatedBorrowAmount < minBorrowForAsset;

            const isComplete = amountNum > 0 && collateralNum > 0;
            const liqRiskRatio = getLiquidationRiskRatio(selectedPool);

            const calculations = useMemo(() => {
              if (!isComplete) return null;

              // On-chain risk ratio = (collateral + borrow) / borrow
              const riskRatio = displayBorrowUsd > 0
                ? (displayCollateralUsd + displayBorrowUsd) / displayBorrowUsd
                : Infinity;

              const exposure = amountNum * leverageNum;
              const exposureUsd = displayExposureUsd;

              const liqFactor = displayBorrowUsd > 0
                ? (liqRiskRatio * displayBorrowUsd) / (displayCollateralUsd + displayBorrowUsd)
                : 0;
              const liqPrice =
                side === "long"
                  ? basePrice * liqFactor
                  : basePrice * (2 - liqFactor);

              const pnlUp = exposure * basePrice * 0.1;
              const pnlDown = exposure * basePrice * 0.1;

              return { exposureUsd, liqPrice, exposure, riskRatio, pnlUp, pnlDown };
            }, [isComplete, amountNum, displayExposureUsd, displayCollateralUsd, displayBorrowUsd, leverageNum, side, basePrice, liqRiskRatio]);

            return (
              <SpotlightCard className="w-full max-w-lg">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Trade</h2>
                    <p className="text-sm text-muted-foreground">
                      Open a leveraged position
                    </p>
                  </div>

                  {/* Margin Pool */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Margin Pool</Label>
                      <div className="flex items-center gap-3">
                        {pairPrice > 0 && (
                          <span className="text-xs font-mono text-muted-foreground">
                            1 {baseAsset} = {pairPrice < 0.1 ? pairPrice.toFixed(4) : pairPrice.toFixed(2)} {quoteAsset}
                          </span>
                        )}
                        <a
                          href="https://dexscreener.com/sui"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Chart
                        </a>
                      </div>
                    </div>
                    <Select value={selectedPool} onValueChange={setSelectedPool}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pools.pools.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <PoolPairIcon baseSymbol={p.baseAsset} quoteSymbol={p.quoteAsset} size={16} />
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Direction */}
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Tabs value={side} onValueChange={(v) => setSide(v as "long" | "short")}>
                      <TabsList className="w-full">
                        <TabsTrigger
                          value="long"
                          className={`flex-1 ${
                            side === "long"
                              ? "!bg-emerald-500/20 !text-emerald-500"
                              : ""
                          }`}
                        >
                          Long
                        </TabsTrigger>
                        <TabsTrigger
                          value="short"
                          className={`flex-1 ${
                            side === "short" ? "!bg-rose-500/20 !text-rose-500" : ""
                          }`}
                        >
                          Short
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label>Amount ({baseAsset})</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>

                  {/* Leverage */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Leverage</Label>
                      <span className="text-sm font-medium text-primary">
                        {leverage[0].toFixed(1)}x
                      </span>
                    </div>
                    <Slider
                      value={leverage}
                      onValueChange={setLeverage}
                      min={1}
                      max={maxLeverage}
                      step={0.1}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1x</span>
                      <span>{maxLeverage}x</span>
                    </div>
                  </div>

                  {/* Collateral — combined input + asset selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Collateral</Label>
                      {isDeepSelected && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <Sparkles className="w-3 h-3" />
                          Cheaper fees
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] ${
                      isBelowMin
                        ? "border-rose-500/50 focus-within:border-rose-500 focus-within:ring-[3px] focus-within:ring-rose-500/20"
                        : "border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
                    }`}>
                      <input
                        type="number"
                        placeholder={minCollateralAmount > 0 ? `Min ${minCollateralAmount < 0.01 ? minCollateralAmount.toPrecision(3) : minCollateralAmount.toFixed(2)}` : "0.00"}
                        value={collateralAmount}
                        onChange={(e) => setCollateralAmount(e.target.value)}
                        className="flex-1 h-9 px-3 bg-transparent text-sm outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <Select value={collateral} onValueChange={setCollateral}>
                        <SelectTrigger className="border-0 shadow-none focus-visible:ring-0 w-auto gap-1.5 pr-3 pl-2 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {collateralOptions.map((option) => (
                            <SelectItem key={option.symbol} value={option.symbol}>
                              <CoinIcon symbol={option.symbol} size={16} />
                              {option.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {amountNum > 0 && minCollateralAmount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className={isBelowMin ? "text-rose-500" : "text-muted-foreground"}>
                          {isBelowMin ? "Below minimum collateral" : "Min collateral required"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCollateralAmount(
                            minCollateralAmount < 0.01
                              ? minCollateralAmount.toPrecision(3)
                              : minCollateralAmount.toFixed(2)
                          )}
                          className="font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          {minCollateralAmount < 0.01 ? minCollateralAmount.toPrecision(3) : minCollateralAmount.toFixed(2)} {collateral}
                        </button>
                      </div>
                    )}
                    {isBelowMinBorrow && (
                      <p className="text-xs text-rose-500">
                        Min borrow is {minBorrowForAsset} {borrowedAsset}. Increase amount or leverage.
                      </p>
                    )}
                  </div>

                  {/* Position Info — only when all fields are filled */}
                  {calculations && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Risk Ratio</span>
                          <span className={`font-mono font-medium ${getRiskColor(calculations.riskRatio)}`}>
                            {calculations.riskRatio === Infinity ? "∞" : calculations.riskRatio.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Liquidation Price</span>
                          <span className="font-mono">
                            ${calculations.liqPrice < 0.01
                              ? calculations.liqPrice.toPrecision(3)
                              : calculations.liqPrice.toFixed(4)}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            Interest Rate
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-muted-foreground/60 hover:text-foreground transition-colors">
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="top" className="w-64 text-xs space-y-1.5 p-3">
                                <p className="font-medium text-foreground">Borrow Interest Rate</p>
                                <p className="text-muted-foreground">
                                  The annualized rate you pay to borrow assets for your leveraged position. Interest accrues continuously and is deducted from your collateral.
                                </p>
                              </PopoverContent>
                            </Popover>
                          </span>
                          <span className="font-mono">
                            {(interestRate * 100).toFixed(1)}%
                            <span className="text-muted-foreground text-xs ml-1">APR</span>
                          </span>
                        </div>

                        <div className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            Exposure
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-muted-foreground/60 hover:text-foreground transition-colors">
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="top" className="w-64 text-xs space-y-2 p-3">
                                <p className="font-medium text-foreground">Projected PnL</p>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{baseAsset} +10%</span>
                                  <span className="text-emerald-500 font-mono">
                                    {side === "long" ? "+" : "-"}${calculations.pnlUp.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{baseAsset} -10%</span>
                                  <span className="text-rose-500 font-mono">
                                    {side === "long" ? "-" : "+"}${calculations.pnlDown.toFixed(2)}
                                  </span>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </span>
                          <span className="font-mono">
                            {calculations.exposure < 0.01
                              ? calculations.exposure.toPrecision(3)
                              : calculations.exposure < 1
                                ? calculations.exposure.toFixed(4)
                                : calculations.exposure.toFixed(2)} {baseAsset}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Transaction status message */}
                  {txStatus && !isSubmitting && (
                    <p className={`text-xs text-center ${
                      txStatus.startsWith("Error") ? "text-rose-500" :
                      txStatus === "Transaction cancelled" ? "text-muted-foreground" :
                      txStatus.includes("successfully") ? "text-emerald-500" :
                      "text-muted-foreground"
                    }`}>
                      {txStatus}
                    </p>
                  )}

                  {/* Stage progress indicator */}
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
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${(txStage.step / txStage.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleOpenPosition}
                    disabled={isSubmitting || !isComplete || isBelowMin || isBelowMinBorrow || !account}
                  >
                    {isSubmitting && txStage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {txStage.label}... ({txStage.step}/{txStage.total})
                      </>
                    ) : !account ? (
                      "Connect Wallet to Trade"
                    ) : (
                      "Open Position"
                    )}
                  </Button>
                </div>
              </SpotlightCard>
            );
          };
        })
      )
    ),
  {
    ssr: false,
    loading: () => <TradeCardSkeleton />,
  }
);

/** Loading skeleton matching the TradeCard layout */
function TradeCardSkeleton() {
  return (
    <SpotlightCard className="w-full max-w-lg">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Trade</h2>
          <p className="text-sm text-muted-foreground">
            Open a leveraged position
          </p>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-muted/50 animate-pulse" />
          ))}
        </div>
        <Button className="w-full" disabled>
          Loading...
        </Button>
      </div>
    </SpotlightCard>
  );
}

export function TradeCard() {
  return <TradeCardInner />;
}
