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
import { Loader2, Info, ExternalLink, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import pools from "@/config/pools.json";
import coins from "@/config/coins.json";
import charts from "@/config/charts.json";
import marginPoolsData from "@/config/margin_pools.json";
import referralsConfig from "@/config/referrals.json";

const marginPoolsConfig = marginPoolsData.marginPools as Record<string, { minBorrow: number }>;
import { CoinIcon, PoolPairIcon } from "@/components/ui/coin-icon";
import {
  getMaxLeverage,
  getMinBorrowRiskRatio,
  getLiquidationRiskRatio,
  getRiskColor,
} from "@/lib/risk";
import { usePrices } from "@/hooks/use-prices";
import { addPosition } from "@/lib/positions";

const coinSymbols = Object.keys(coins.coins) as Array<keyof typeof coins.coins>;

/**
 * Inner component loaded dynamically — has access to dapp-kit hooks.
 */
const TradeCardInner = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) =>
      import("@mysten/deepbook-v3").then((deepbookMod) =>
        import("@/lib/deepbook/transactions").then((txMod) =>
          import("@/hooks/use-interest-rates").then((irMod) => {
          const { useCurrentAccount, useCurrentClient, useDAppKit } = dappKit;
          const { DeepBookClient } = deepbookMod;
          const {
            buildCreateManagerAndDepositTx,
            buildBorrowAndOrderTx,
            extractMarginManagerAddress,
            createClientWithManagers,
            formatTxError,
            queryMarginPoolState,
            buildSupplyToPoolTx,
          } = txMod;
          type PoolState = Awaited<ReturnType<typeof queryMarginPoolState>>;
          const { useInterestRates } = irMod;

          // MarginManager map: managerKey → { address, poolKey }
          type ManagerEntry = { address: string; poolKey: string };

          return function TradeCardWithWallet() {
            const account = useCurrentAccount();
            const suiClient = useCurrentClient();
            const dAppKitInstance = useDAppKit();
            const router = useRouter();

            const [side, setSide] = useState<"long" | "short">("long");
            const [leverage, setLeverage] = useState([2]);
            const [selectedPool, setSelectedPool] = useState(pools.pools[0].id);
            const [amount, setAmount] = useState("");
            const [collateral, setCollateral] = useState("USDC");
            const [collateralAmount, setCollateralAmount] = useState("");
            const [collateralManuallyEdited, setCollateralManuallyEdited] = useState(false);

            // Stores all created margin managers: unique key → { address, poolKey }
            const [marginManagers, setMarginManagers] = useState<Record<string, ManagerEntry>>({});
            const [isSubmitting, setIsSubmitting] = useState(false);
            const [txStage, setTxStage] = useState<{ step: number; total: number; label: string } | null>(null);
            const [txStatus, setTxStatus] = useState<string | null>(null);

            // Supply popup state — shown when margin pool has insufficient liquidity
            const [supplyPopup, setSupplyPopup] = useState<{
              poolState: PoolState;
              borrowNeeded: number;
              shortfall: number;
              // Context to resume TX2 after supply
              pendingTx2: {
                clientWithManagers: any;
                managerKey: string;
                borrowAmount: number;
                orderQuantity: number;
                payWithDeep: boolean;
              };
            } | null>(null);
            const [supplyAmount, setSupplyAmount] = useState("");
            const [isSupplying, setIsSupplying] = useState(false);

            const { getUsdPrice, getPairPrice } = usePrices();
            const { rates: interestRates } = useInterestRates(suiClient, account?.address);

            const pool = pools.pools.find((p) => p.id === selectedPool) || pools.pools[0];
            const baseAsset = pool.baseAsset;
            const quoteAsset = pool.quoteAsset;
            const basePrice = getUsdPrice(baseAsset);
            const quotePrice = getUsdPrice(quoteAsset);
            const pairPrice = getPairPrice(baseAsset, quoteAsset);
            // Interest rate for the borrowed asset (long → borrow quote, short → borrow base)
            const borrowedAssetForRate = side === "long" ? quoteAsset : baseAsset;
            const interestRate = interestRates[borrowedAssetForRate] ?? 0;
            const maxLeverage = getMaxLeverage(selectedPool);

            // Each position is fully isolated — new manager per trade

            // Wallet balance for the selected collateral asset
            const [walletBalance, setWalletBalance] = useState<number | null>(null);
            const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);

            useEffect(() => {
              if (!account?.address || !suiClient) {
                setWalletBalance(null);
                return;
              }
              const coinConfig = (coins.coins as Record<string, { type: string; decimals: number }>)[collateral];
              if (!coinConfig) {
                setWalletBalance(null);
                return;
              }
              let cancelled = false;
              suiClient.core
                .getBalance({ owner: account.address, coinType: coinConfig.type })
                .then((res: any) => {
                  if (!cancelled) {
                    const raw = BigInt(res.balance?.balance ?? res.balance?.coinBalance ?? "0");
                    setWalletBalance(Number(raw) / Math.pow(10, coinConfig.decimals));
                  }
                })
                .catch(() => {
                  if (!cancelled) setWalletBalance(null);
                });
              return () => { cancelled = true; };
            }, [account?.address, suiClient, collateral, balanceRefreshKey]);

            // Reset manual-edit flag when inputs that determine collateral change
            // NOTE: leverage is NOT included — changing leverage from collateral input
            // should not reset the flag (would cause circular updates)
            useEffect(() => {
              setCollateralManuallyEdited(false);
            }, [amount, selectedPool, collateral]);

            // Auto-fill collateral to match selected leverage
            // Amount = total position size, so: collateral = amount * basePrice / leverage / collateralPrice
            useEffect(() => {
              if (collateralManuallyEdited) return;
              const amtNum = parseFloat(amount) || 0;
              const lev = leverage[0];
              if (amtNum <= 0 || basePrice <= 0 || lev <= 0) {
                setCollateralAmount("");
                return;
              }
              const collateralAssetPrice = getUsdPrice(collateral);
              if (collateralAssetPrice <= 0) return;
              const targetCollateral = (amtNum * basePrice) / (lev * collateralAssetPrice);
              setCollateralAmount(
                targetCollateral < 0.01
                  ? targetCollateral.toPrecision(3)
                  : targetCollateral < 1
                    ? targetCollateral.toFixed(4)
                    : targetCollateral.toFixed(2)
              );
            }, [amount, leverage, basePrice, collateral, getUsdPrice, collateralManuallyEdited]);

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

              const orderQuantity = amountNum; // Amount = total position size
              const payWithDeep = collateral === "DEEP";

              // --- All calculations in USD ---
              const collateralAssetPrice = getUsdPrice(collateral);
              const exposureUsd = orderQuantity * basePrice;
              const collateralUsd = collateralNum * collateralAssetPrice;
              const borrowUsdRaw = exposureUsd - collateralUsd;

              // Convert borrow USD back to the actual borrowed asset
              // Long → borrow quote, Short → borrow base
              // Add 0.5% buffer for taker fees — bid orders need extra quote
              // to cover the fee on top of the fill cost
              const FEE_BUFFER = 1.005;
              let borrowAmount: number;
              if (borrowUsdRaw <= 0) {
                borrowAmount = 0; // Fully collateralized, no borrow needed
              } else if (side === "long") {
                borrowAmount = quotePrice > 0 ? (borrowUsdRaw / quotePrice) * FEE_BUFFER : 0;
              } else {
                borrowAmount = basePrice > 0 ? (borrowUsdRaw / basePrice) * FEE_BUFFER : 0;
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
                // === Step 0: Log pool diagnostics ===
                const borrowedAssetKey = side === "long" ? quoteAsset : baseAsset;
                try {
                  const poolDiag = await queryMarginPoolState(
                    baseClient, suiClient, account.address, borrowedAssetKey
                  );
                  const utilization = poolDiag.totalSupply > 0
                    ? (poolDiag.totalBorrow / poolDiag.totalSupply * 100).toFixed(2)
                    : "N/A";
                  console.log(
                    `%c[Pool Diagnostics] ${borrowedAssetKey} Margin Pool`,
                    "color: cyan; font-weight: bold",
                  );
                  console.table({
                    "Total Supply": poolDiag.totalSupply,
                    "Total Borrowed": poolDiag.totalBorrow,
                    "Max Utilization Rate": `${(poolDiag.maxUtilizationRate * 100).toFixed(1)}%`,
                    "Current Utilization": `${utilization}%`,
                    "Available to Borrow": Math.max(0, poolDiag.available),
                    "You Want to Borrow": borrowAmount,
                    "Can Borrow?": poolDiag.available >= borrowAmount ? "YES" : "NO — need to supply",
                  });
                } catch (diagErr) {
                  console.warn("[Pool Diagnostics] Failed:", diagErr);
                }

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

                // Persist to localStorage so the dashboard can find it
                addPosition({
                  managerAddress,
                  poolKey: selectedPool,
                  side,
                  collateralAsset: collateral,
                  createdAt: Date.now(),
                });

                // === Check pool liquidity before TX2 ===
                setTxStage({ step: 2, total: 3, label: "Checking pool liquidity" });

                const clientWithManagers = createClientWithManagers(
                  suiClient,
                  account.address,
                  newManagers
                );

                const borrowedAsset = side === "long" ? quoteAsset : baseAsset;

                if (borrowAmount > 0) {
                  try {
                    const poolState = await queryMarginPoolState(
                      baseClient,
                      suiClient,
                      account.address,
                      borrowedAsset
                    );

                    console.log("[PoolCheck]", borrowedAsset, "pool state:", {
                      totalSupply: poolState.totalSupply,
                      totalBorrow: poolState.totalBorrow,
                      maxUtil: poolState.maxUtilizationRate,
                      available: poolState.available,
                      borrowNeeded: borrowAmount,
                    });

                    if (poolState.available < borrowAmount) {
                      // Pool can't support the borrow — show supply popup
                      const shortfall = borrowAmount - Math.max(0, poolState.available);
                      setTxStage(null);
                      setIsSubmitting(false);
                      setSupplyPopup({
                        poolState,
                        borrowNeeded: borrowAmount,
                        shortfall,
                        pendingTx2: {
                          clientWithManagers,
                          managerKey,
                          borrowAmount,
                          orderQuantity,
                          payWithDeep,
                        },
                      });
                      setSupplyAmount(Math.ceil(shortfall * 1.05).toString()); // 5% buffer
                      return; // Pause — user needs to supply first
                    }
                  } catch (poolCheckErr) {
                    // Non-fatal: log and proceed with the borrow attempt
                    console.warn("[PoolCheck] Failed to query pool state, proceeding anyway:", poolCheckErr);
                  }
                }

                // === TX2: Borrow + market order ===
                setTxStage({ step: 3, total: 3, label: "Opening position" });

                const referralId = (referralsConfig.referrals as Record<string, string | null>)[selectedPool] ?? undefined;
                const orderTx = buildBorrowAndOrderTx(
                  clientWithManagers,
                  managerKey,
                  selectedPool,
                  side,
                  borrowAmount,
                  orderQuantity,
                  payWithDeep,
                  referralId
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
                setBalanceRefreshKey((k) => k + 1);
                router.push("/dashboard");
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

            /** Supply liquidity to the margin pool, then resume TX2. */
            const handleSupplyAndResume = useCallback(async () => {
              if (!baseClient || !account || !suiClient || !supplyPopup) return;

              const supplyNum = parseFloat(supplyAmount) || 0;
              if (supplyNum <= 0) return;

              setIsSupplying(true);
              try {
                // Supply to the margin pool
                const supplyTx = buildSupplyToPoolTx(
                  baseClient,
                  supplyPopup.poolState.coinKey,
                  supplyNum
                );

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: supplyTx,
                });

                // Now resume TX2 with the pending context
                const { clientWithManagers, managerKey, borrowAmount, orderQuantity, payWithDeep } = supplyPopup.pendingTx2;

                setSupplyPopup(null);
                setIsSubmitting(true);
                setTxStage({ step: 3, total: 3, label: "Opening position" });

                const resumeReferralId = (referralsConfig.referrals as Record<string, string | null>)[selectedPool] ?? undefined;
                const orderTx = buildBorrowAndOrderTx(
                  clientWithManagers,
                  managerKey,
                  selectedPool,
                  side,
                  borrowAmount,
                  orderQuantity,
                  payWithDeep,
                  resumeReferralId
                );

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: orderTx,
                });

                setTxStage(null);
                setTxStatus("Position opened successfully!");
                setAmount("");
                setCollateralAmount("");
                setBalanceRefreshKey((k) => k + 1);
                router.push("/dashboard");
              } catch (err: any) {
                console.error("Supply/resume failed:", err);
                setTxStatus(formatTxError(err));
                setTxStage(null);
              } finally {
                setIsSupplying(false);
                setIsSubmitting(false);
              }
            }, [baseClient, account, suiClient, supplyPopup, supplyAmount, selectedPool, side, dAppKitInstance]);

            const amountNum = parseFloat(amount) || 0;
            const collateralNum = parseFloat(collateralAmount) || 0;
            const insufficientBalance = walletBalance !== null && collateralNum > 0 && collateralNum > walletBalance;

            const collateralOptions = useMemo(() => {
              const seen = new Set<string>();
              const opts: { symbol: string }[] = [];
              for (const s of [quoteAsset, baseAsset]) {
                if (!seen.has(s) && coinSymbols.includes(s as keyof typeof coins.coins)) {
                  seen.add(s);
                  opts.push({ symbol: s });
                }
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

            // --- All display calculations in USD ---
            const collateralPrice = getUsdPrice(collateral);
            const displayExposureUsd = amountNum * basePrice; // Amount = total position size
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

              const exposure = amountNum; // Amount = total position size
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
            }, [isComplete, amountNum, displayExposureUsd, displayCollateralUsd, displayBorrowUsd, side, basePrice, liqRiskRatio]);

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
                          href={(charts.charts as Record<string, string>)[selectedPool] ?? "https://www.tradingview.com"}
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
                      onValueChange={(val) => {
                        setLeverage(val);
                        setCollateralManuallyEdited(false); // Allow auto-fill from slider
                      }}
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
                      <div className="flex items-center gap-2">
                        {walletBalance !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setCollateralAmount(
                                walletBalance < 0.01
                                  ? walletBalance.toPrecision(3)
                                  : walletBalance.toFixed(4)
                              );
                              setCollateralManuallyEdited(true);
                              // Reverse: compute leverage from wallet balance
                              if (walletBalance > 0 && amountNum > 0 && collateralPrice > 0 && basePrice > 0) {
                                const newLev = (amountNum * basePrice) / (walletBalance * collateralPrice);
                                const clamped = Math.min(maxLeverage, Math.max(1, Math.round(newLev * 10) / 10));
                                setLeverage([clamped]);
                              }
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            Bal: <span className="font-mono">{
                              walletBalance < 0.01
                                ? walletBalance.toPrecision(3)
                                : walletBalance < 1
                                  ? walletBalance.toFixed(4)
                                  : walletBalance.toFixed(2)
                            }</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`flex items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] ${
                      isBelowMin || insufficientBalance
                        ? "border-rose-500/50 focus-within:border-rose-500 focus-within:ring-[3px] focus-within:ring-rose-500/20"
                        : "border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
                    }`}>
                      <input
                        type="number"
                        placeholder={minCollateralAmount > 0 ? `Min ${minCollateralAmount < 0.01 ? minCollateralAmount.toPrecision(3) : minCollateralAmount.toFixed(2)}` : "0.00"}
                        value={collateralAmount}
                        onChange={(e) => {
                          setCollateralAmount(e.target.value);
                          setCollateralManuallyEdited(true);
                          // Reverse: compute leverage from collateral
                          const colNum = parseFloat(e.target.value) || 0;
                          if (colNum > 0 && amountNum > 0 && collateralPrice > 0 && basePrice > 0) {
                            const newLev = (amountNum * basePrice) / (colNum * collateralPrice);
                            const clamped = Math.min(maxLeverage, Math.max(1, Math.round(newLev * 10) / 10));
                            setLeverage([clamped]);
                          }
                        }}
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
                          onClick={() => {
                            setCollateralAmount(
                              minCollateralAmount < 0.01
                                ? minCollateralAmount.toPrecision(3)
                                : minCollateralAmount.toFixed(2)
                            );
                            setCollateralManuallyEdited(true);
                            // Reverse: compute leverage from min collateral
                            if (minCollateralAmount > 0 && amountNum > 0 && collateralPrice > 0 && basePrice > 0) {
                              const newLev = (amountNum * basePrice) / (minCollateralAmount * collateralPrice);
                              const clamped = Math.min(maxLeverage, Math.max(1, Math.round(newLev * 10) / 10));
                              setLeverage([clamped]);
                            }
                          }}
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
                    {insufficientBalance && (
                      <p className="text-xs text-rose-500">
                        Insufficient {collateral} balance. You have {
                          walletBalance! < 0.01
                            ? walletBalance!.toPrecision(3)
                            : walletBalance! < 1
                              ? walletBalance!.toFixed(4)
                              : walletBalance!.toFixed(2)
                        } {collateral}.
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

                  {/* Supply popup — shown when margin pool has insufficient liquidity */}
                  {supplyPopup && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <h3 className="text-sm font-semibold text-yellow-500">
                          Insufficient Pool Liquidity
                        </h3>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pool</span>
                          <span className="font-mono">{supplyPopup.poolState.coinKey} Margin Pool</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Supply</span>
                          <span className="font-mono">{supplyPopup.poolState.totalSupply.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Borrowed</span>
                          <span className="font-mono">{supplyPopup.poolState.totalBorrow.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Max Utilization</span>
                          <span className="font-mono">{(supplyPopup.poolState.maxUtilizationRate * 100).toFixed(0)}%</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Available to Borrow</span>
                          <span className="font-mono">
                            {Math.max(0, supplyPopup.poolState.available).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-yellow-500">You Need</span>
                          <span className="font-mono text-yellow-500">
                            {supplyPopup.borrowNeeded.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-rose-500">Shortfall</span>
                          <span className="font-mono text-rose-500">
                            {supplyPopup.shortfall.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Supply {supplyPopup.poolState.coinKey} to the margin pool to add liquidity, then your position will open automatically.
                      </p>

                      <div className="space-y-2">
                        <Label className="text-xs">Supply Amount ({supplyPopup.poolState.coinKey})</Label>
                        <Input
                          type="number"
                          placeholder={supplyPopup.shortfall.toFixed(2)}
                          value={supplyAmount}
                          onChange={(e) => setSupplyAmount(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSupplyPopup(null)}
                          disabled={isSupplying}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                          onClick={handleSupplyAndResume}
                          disabled={isSupplying || (parseFloat(supplyAmount) || 0) <= 0}
                        >
                          {isSupplying ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Supplying...
                            </>
                          ) : (
                            `Supply & Open Position`
                          )}
                        </Button>
                      </div>
                    </div>
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
                    disabled={isSubmitting || !isComplete || isBelowMin || isBelowMinBorrow || insufficientBalance || !account}
                  >
                    {isSubmitting && txStage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {txStage.label}... ({txStage.step}/{txStage.total})
                      </>
                    ) : !account ? (
                      "Connect Wallet to Trade"
                    ) : insufficientBalance ? (
                      `Insufficient ${collateral} Balance`
                    ) : (
                      "Open Position"
                    )}
                  </Button>
                </div>
              </SpotlightCard>
            );
          };
        }))
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
