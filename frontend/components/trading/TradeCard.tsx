"use client";

import { useState, useMemo } from "react";
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
import { Sparkles } from "lucide-react";
import pools from "@/config/pools.json";

// Mock prices for different assets
const mockPrices: Record<string, number> = {
  SUI: 3.45,
  ETH: 3820.5,
  BTC: 97500,
  USDC: 1,
  DEEP: 0.042,
};

export function TradeCard() {
  const [side, setSide] = useState("long");
  const [leverage, setLeverage] = useState([2]);
  const [selectedPool, setSelectedPool] = useState(pools.pools[0].id);
  const [amount, setAmount] = useState("");
  const [collateral, setCollateral] = useState("USDC");

  const pool = pools.pools.find((p) => p.id === selectedPool) || pools.pools[0];
  const baseAsset = pool.baseAsset.symbol;
  const quoteAsset = pool.quoteAsset.symbol;
  const currentPrice = mockPrices[baseAsset] || 1;

  const amountNum = parseFloat(amount) || 0;
  const leverageNum = leverage[0];

  // Collateral options: base asset, quote asset, and DEEP
  const collateralOptions = [
    { symbol: quoteAsset, label: quoteAsset, cheaper: false },
    { symbol: baseAsset, label: baseAsset, cheaper: false },
    { symbol: "DEEP", label: "DEEP", cheaper: true },
  ];

  const calculations = useMemo(() => {
    if (amountNum <= 0) return null;

    const positionSize = amountNum * leverageNum;
    const liquidationDistance = 1 / leverageNum;
    const liqPrice =
      side === "long"
        ? currentPrice * (1 - liquidationDistance + 0.01)
        : currentPrice * (1 + liquidationDistance - 0.01);

    // Exposure in the base asset
    const exposure = positionSize / currentPrice;

    // Risk score: 2.0 = safe, 1.0 = near liquidation
    // Higher leverage = lower score (closer to liquidation)
    const riskScore = Math.max(1, Math.min(2, 2.5 - leverageNum * 0.3));

    return {
      positionSize,
      liqPrice,
      exposure,
      riskScore,
    };
  }, [amountNum, leverageNum, side, currentPrice]);

  const getRiskColor = (score: number) => {
    if (score >= 1.8) return "text-emerald-500";
    if (score >= 1.4) return "text-yellow-500";
    return "text-rose-500";
  };

  const getRiskLabel = (score: number) => {
    if (score >= 1.8) return "Safe";
    if (score >= 1.4) return "Moderate";
    return "At Risk";
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

        <div className="space-y-2">
          <Label>Pool</Label>
          <Select value={selectedPool} onValueChange={setSelectedPool}>
            <SelectTrigger>
              <SelectValue placeholder="Select pool" />
            </SelectTrigger>
            <SelectContent>
              {pools.pools.map((pool) => (
                <SelectItem key={pool.id} value={pool.id}>
                  {pool.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        <div className="space-y-2">
          <Label>Amount (USDC)</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Collateral Asset</Label>
          <Select value={collateral} onValueChange={setCollateral}>
            <SelectTrigger>
              <SelectValue placeholder="Select collateral" />
            </SelectTrigger>
            <SelectContent>
              {collateralOptions.map((option) => (
                <SelectItem key={option.symbol} value={option.symbol}>
                  <span className="flex items-center gap-2">
                    {option.label}
                    {option.cheaper && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Sparkles className="w-3 h-3" />
                        Cheaper fees
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            max={5}
            step={0.1}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1x</span>
            <span>5x</span>
          </div>
        </div>

        {calculations && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Position Size</span>
                <span className="font-mono">
                  {calculations.positionSize.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Exposure</span>
                <span className="font-mono">
                  {calculations.exposure.toFixed(4)} {baseAsset}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Liquidation Price</span>
                <span className="font-mono text-rose-500/80">
                  ${calculations.liqPrice.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Risk</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        calculations.riskScore >= 1.8
                          ? "bg-emerald-500"
                          : calculations.riskScore >= 1.4
                          ? "bg-yellow-500"
                          : "bg-rose-500"
                      }`}
                      style={{
                        width: `${((calculations.riskScore - 1) / 1) * 100}%`,
                      }}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium ${getRiskColor(
                      calculations.riskScore
                    )}`}
                  >
                    {calculations.riskScore.toFixed(1)} ({getRiskLabel(calculations.riskScore)})
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        <Button className="w-full">Open Position</Button>
      </div>
    </SpotlightCard>
  );
}
