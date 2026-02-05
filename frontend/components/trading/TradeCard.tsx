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
import pools from "@/config/pools.json";

export function TradeCard() {
  const [side, setSide] = useState("long");
  const [leverage, setLeverage] = useState([2]);
  const [selectedPool, setSelectedPool] = useState(pools.pools[0].id);
  const [amount, setAmount] = useState("");

  const currentPrice = 3.45; // Mock price
  const amountNum = parseFloat(amount) || 0;
  const leverageNum = leverage[0];

  const calculations = useMemo(() => {
    if (amountNum <= 0) return null;

    const positionSize = amountNum * leverageNum;
    const liquidationDistance = 1 / leverageNum;
    const liqPrice =
      side === "long"
        ? currentPrice * (1 - liquidationDistance + 0.01)
        : currentPrice * (1 + liquidationDistance - 0.01);

    // Risk score: 1-10 based on leverage and position size
    const riskScore = Math.min(10, Math.round(leverageNum * 1.5 + (amountNum > 500 ? 2 : 0)));

    return {
      positionSize,
      liqPrice,
      riskScore,
    };
  }, [amountNum, leverageNum, side, currentPrice]);

  const getRiskColor = (score: number) => {
    if (score <= 3) return "text-emerald-500";
    if (score <= 6) return "text-yellow-500";
    return "text-rose-500";
  };

  const getRiskLabel = (score: number) => {
    if (score <= 3) return "Low";
    if (score <= 6) return "Medium";
    return "High";
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
                <span className="text-muted-foreground">Est. Liq. Price</span>
                <span className="font-mono">
                  ${calculations.liqPrice.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Risk Level</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-3 rounded-sm ${
                          i < calculations.riskScore
                            ? calculations.riskScore <= 3
                              ? "bg-emerald-500"
                              : calculations.riskScore <= 6
                              ? "bg-yellow-500"
                              : "bg-rose-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-xs font-medium ${getRiskColor(
                      calculations.riskScore
                    )}`}
                  >
                    {getRiskLabel(calculations.riskScore)}
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
