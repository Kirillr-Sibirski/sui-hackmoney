"use client";

import { useState, useMemo, useCallback } from "react";
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
import marginPoolsConfig from "@/config/margin_pools.json";
import coins from "@/config/coins.json";
import { CoinIcon, PoolPairIcon } from "@/components/ui/coin-icon";

const coinSymbols = Object.keys(coins.coins) as Array<keyof typeof coins.coins>;
const marginPoolKeys = Object.keys(marginPoolsConfig.marginPools);

// Mock prices
const mockPrices: Record<string, number> = {
  SUI: 3.45,
  DEEP: 0.042,
  DBUSDC: 1,
};

// Mock interest rate (annualized, per pool)
const mockInterestRates: Record<string, number> = {
  SUI_DBUSDC: 0.085,
  DEEP_SUI: 0.12,
  DEEP_DBUSDC: 0.11,
};

function getRequiredMarginPools(baseAsset: string, quoteAsset: string): string[] {
  return [baseAsset, quoteAsset].filter((s) => marginPoolKeys.includes(s));
}

export function TradeCard() {
  const [side, setSide] = useState("long");
  const [leverage, setLeverage] = useState([2]);
  const [selectedPool, setSelectedPool] = useState(pools.pools[0].id);
  const [amount, setAmount] = useState("");
  const [collateral, setCollateral] = useState("DBUSDC");
  const [collateralAmount, setCollateralAmount] = useState("");

  const [marginManagers, setMarginManagers] = useState<Record<string, boolean>>({});
  const [creatingManagers, setCreatingManagers] = useState(false);

  const pool = pools.pools.find((p) => p.id === selectedPool) || pools.pools[0];
  const baseAsset = pool.baseAsset;
  const quoteAsset = pool.quoteAsset;
  const currentPrice = mockPrices[baseAsset] || 1;
  const interestRate = mockInterestRates[selectedPool] ?? 0.1;

  const requiredMarginPools = useMemo(
    () => getRequiredMarginPools(baseAsset, quoteAsset),
    [baseAsset, quoteAsset]
  );
  const missingManagers = requiredMarginPools.filter((mp) => !marginManagers[mp]);
  const allManagersReady = missingManagers.length === 0;

  const handleOpenPosition = useCallback(async () => {
    if (!allManagersReady) {
      setCreatingManagers(true);
      try {
        // TODO: Replace with actual DeepBook SDK calls:
        // For each missing margin pool, call:
        //   const tx = new Transaction();
        //   dbClient.marginManager.newMarginManager(poolKey)(tx);
        //   await signAndExecuteTransaction({ transaction: tx });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setMarginManagers((prev) => {
          const next = { ...prev };
          for (const mp of missingManagers) {
            next[mp] = true;
          }
          return next;
        });
      } catch (err) {
        console.error("Failed to create margin managers:", err);
      } finally {
        setCreatingManagers(false);
      }
      return;
    }

    // TODO: Open the actual position
    console.log("Opening position:", { pool: selectedPool, side, amount, leverage, collateral, collateralAmount });
  }, [allManagersReady, missingManagers, selectedPool, side, amount, leverage, collateral, collateralAmount]);

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

  // Only show stats when all inputs are filled
  const isComplete = amountNum > 0 && collateralNum > 0;

  const calculations = useMemo(() => {
    if (!isComplete) return null;

    const positionSize = amountNum * leverageNum;
    const liquidationDistance = 1 / leverageNum;
    const liqPrice =
      side === "long"
        ? currentPrice * (1 - liquidationDistance + 0.01)
        : currentPrice * (1 + liquidationDistance - 0.01);

    const exposure = positionSize / currentPrice;
    const riskScore = Math.max(1, Math.min(2, 2.5 - leverageNum * 0.3));

    const pnlUp = exposure * currentPrice * 0.1;
    const pnlDown = exposure * currentPrice * 0.1;

    return { positionSize, liqPrice, exposure, riskScore, pnlUp, pnlDown };
  }, [isComplete, amountNum, leverageNum, side, currentPrice]);

  const getRiskColor = (score: number) => {
    if (score >= 1.8) return "text-emerald-500";
    if (score >= 1.4) return "text-yellow-500";
    return "text-rose-500";
  };

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
          <Tabs value={side} onValueChange={setSide}>
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
          <Label>Amount ({quoteAsset})</Label>
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
            max={pool.maxLeverage}
            step={0.1}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1x</span>
            <span>{pool.maxLeverage}x</span>
          </div>
        </div>

        {/* Collateral — combined input + asset selector */}
        <div className="space-y-2">
          <Label>Collateral</Label>
          <div className="flex items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 transition-[color,box-shadow]">
            <input
              type="number"
              placeholder="0.00"
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
                  <SelectItem key={option.symbol} value={option.symbol} className="group">
                    <CoinIcon symbol={option.symbol} size={16} />
                    {option.symbol}
                    {option.cheaper && (
                      <span className="flex items-center gap-1 text-xs text-primary group-focus:text-accent-foreground transition-colors">
                        <Sparkles className="w-3 h-3" />
                        Cheaper fees
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Position Info — only when all fields are filled */}
        {calculations && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Risk</span>
                <span className={`font-mono font-medium ${getRiskColor(calculations.riskScore)}`}>
                  {calculations.riskScore.toFixed(1)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Liquidation Price</span>
                <span className="font-mono text-rose-500/80">
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
                  {calculations.exposure.toFixed(4)} {baseAsset}
                </span>
              </div>
            </div>
          </>
        )}

        <Button
          className="w-full"
          onClick={handleOpenPosition}
          disabled={creatingManagers || !isComplete}
        >
          {creatingManagers ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Setting up margin managers...
            </>
          ) : allManagersReady ? (
            "Open Position"
          ) : (
            "Set Up & Open Position"
          )}
        </Button>
      </div>
    </SpotlightCard>
  );
}
