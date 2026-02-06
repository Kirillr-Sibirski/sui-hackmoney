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
import { CoinIcon, PoolPairIcon } from "@/components/ui/coin-icon";
import {
  getMaxLeverage,
  getMinCollateralUsd,
  getLiquidationRiskRatio,
  calculateRiskRatio,
  getRiskColor,
} from "@/lib/risk";
import { usePrices } from "@/hooks/use-prices";

const coinSymbols = Object.keys(coins.coins) as Array<keyof typeof coins.coins>;
// Mock interest rate (annualized, per pool)
const mockInterestRates: Record<string, number> = {
  SUI_DBUSDC: 0.085,
  DEEP_SUI: 0.12,
  DEEP_DBUSDC: 0.11,
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
            buildNewMarginManagerTx,
            buildOpenPositionTx,
            extractMarginManagerAddress,
            createClientWithManagers,
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
            const [collateral, setCollateral] = useState("DBUSDC");
            const [collateralAmount, setCollateralAmount] = useState("");

            // Stores created margin managers: poolKey → { address, poolKey }
            const [marginManagers, setMarginManagers] = useState<Record<string, ManagerEntry>>({});
            const [isSubmitting, setIsSubmitting] = useState(false);
            const [txStage, setTxStage] = useState<{ step: number; total: number; label: string } | null>(null);
            const [txStatus, setTxStatus] = useState<string | null>(null);

            const { getUsdPrice, getPairPrice } = usePrices();

            const pool = pools.pools.find((p) => p.id === selectedPool) || pools.pools[0];
            const baseAsset = pool.baseAsset;
            const quoteAsset = pool.quoteAsset;
            const basePrice = getUsdPrice(baseAsset);
            const pairPrice = getPairPrice(baseAsset, quoteAsset);
            const interestRate = mockInterestRates[selectedPool] ?? 0.1;
            const maxLeverage = getMaxLeverage(selectedPool);

            // Check if a margin manager exists for the current pool
            const hasManager = !!marginManagers[selectedPool];

            // Base client (no managers) for creating new managers
            const baseClient = useMemo(() => {
              if (!account?.address || !suiClient) return null;
              try {
                return new DeepBookClient({
                  client: suiClient,
                  network: "testnet",
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

              setIsSubmitting(true);
              setTxStatus(null);
              const totalSteps = hasManager ? 1 : 2;

              try {
                let currentManagers = { ...marginManagers };

                // Step 1: Create margin manager if needed
                if (!hasManager) {
                  setTxStage({ step: 1, total: totalSteps, label: "Creating margin manager" });
                  const createTx = buildNewMarginManagerTx(baseClient, selectedPool);
                  const result = await dAppKitInstance.signAndExecuteTransaction({
                    transaction: createTx,
                  });

                  // Extract created MarginManager object ID from tx effects
                  const managerAddress = extractMarginManagerAddress(result as any);
                  if (!managerAddress) {
                    throw new Error("Failed to extract margin manager address from transaction");
                  }

                  // Store the manager entry
                  const managerKey = selectedPool;
                  currentManagers = {
                    ...currentManagers,
                    [managerKey]: { address: managerAddress, poolKey: selectedPool },
                  };
                  setMarginManagers(currentManagers);
                }

                // Step 2: Calculate debt and order quantity, build single PTB
                const amountNum = parseFloat(amount) || 0;
                const collateralNum = parseFloat(collateralAmount) || 0;
                const leverageNum = leverage[0];

                const collateralUsdPrice = getUsdPrice(collateral);
                const exposureUsd = amountNum * basePrice * leverageNum;
                const collateralUsd = collateralNum * collateralUsdPrice;
                const debtUsd = exposureUsd - collateralUsd;

                // Convert debt to the token amount of the borrowed asset
                // Long → borrow quote, Short → borrow base
                let borrowAmount: number;
                if (side === "long") {
                  const quotePrice = getUsdPrice(quoteAsset);
                  borrowAmount = quotePrice > 0 ? debtUsd / quotePrice : 0;
                } else {
                  borrowAmount = basePrice > 0 ? debtUsd / basePrice : 0;
                }

                if (borrowAmount <= 0) {
                  setTxStatus("Invalid borrow amount. Check your inputs.");
                  setIsSubmitting(false);
                  return;
                }

                // Order quantity = total exposure in base asset terms
                const orderQuantity = amountNum * leverageNum;

                // Recreate client with the margin managers map
                const managerKey = selectedPool;
                const clientWithManagers = createClientWithManagers(
                  suiClient,
                  account.address,
                  currentManagers
                );

                setTxStage({ step: totalSteps, total: totalSteps, label: "Opening position" });
                // Single PTB: deposit → borrow → place market order
                const tx = buildOpenPositionTx(
                  clientWithManagers,
                  managerKey,
                  selectedPool,
                  baseAsset,
                  quoteAsset,
                  collateral,
                  collateralNum,
                  side,
                  borrowAmount,
                  orderQuantity
                );

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: tx,
                });

                setTxStage(null);
                setTxStatus("Position opened successfully!");
                // Reset form
                setAmount("");
                setCollateralAmount("");
              } catch (err: any) {
                console.error("Transaction failed:", err);
                setTxStage(null);
                setTxStatus(`Error: ${err?.message || "Transaction failed"}`);
              } finally {
                setIsSubmitting(false);
              }
            }, [
              baseClient,
              account,
              suiClient,
              hasManager,
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

            // Calculate min collateral dynamically
            const collateralPrice = getUsdPrice(collateral);
            const exposureUsd = amountNum * basePrice * leverageNum;
            const minCollateralUsd = amountNum > 0 ? getMinCollateralUsd(exposureUsd, selectedPool) : 0;
            const minCollateralAmount = collateralPrice > 0 ? minCollateralUsd / collateralPrice : 0;
            const isBelowMin = collateralNum > 0 && collateralNum < minCollateralAmount;

            const isComplete = amountNum > 0 && collateralNum > 0;
            const liqRiskRatio = getLiquidationRiskRatio(selectedPool);

            const calculations = useMemo(() => {
              if (!isComplete) return null;

              const collateralUsd = collateralNum * collateralPrice;
              const debtUsd = exposureUsd - collateralUsd;
              const riskRatio = calculateRiskRatio(exposureUsd, debtUsd);

              const liqFactor = debtUsd > 0 ? (liqRiskRatio * debtUsd) / exposureUsd : 0;
              const liqPrice =
                side === "long"
                  ? basePrice * liqFactor
                  : basePrice * (2 - liqFactor);

              const exposure = amountNum * leverageNum;
              const pnlUp = exposure * basePrice * 0.1;
              const pnlDown = exposure * basePrice * 0.1;

              return { exposureUsd, liqPrice, exposure, riskRatio, pnlUp, pnlDown };
            }, [isComplete, amountNum, collateralNum, collateralPrice, exposureUsd, leverageNum, side, basePrice, liqRiskRatio]);

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
                            ${calculations.liqPrice.toFixed(4)}
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
                            {calculations.exposure.toFixed(2)} {baseAsset}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Transaction status message */}
                  {txStatus && !isSubmitting && (
                    <p className={`text-xs text-center ${
                      txStatus.startsWith("Error") ? "text-rose-500" :
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
                    disabled={isSubmitting || !isComplete || isBelowMin || !account}
                  >
                    {isSubmitting && txStage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {txStage.label}... ({txStage.step}/{txStage.total})
                      </>
                    ) : !account ? (
                      "Connect Wallet to Trade"
                    ) : hasManager ? (
                      "Open Position"
                    ) : (
                      "Set Up & Open Position"
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
