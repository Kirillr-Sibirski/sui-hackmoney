"use client";

import { useState } from "react";
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
import { calculateModifiedRiskRatio, getRiskColor, getRiskLabel } from "@/lib/risk";
import { usePrices } from "@/hooks/use-prices";
import Link from "next/link";

const mockPositions = [
  {
    id: "1",
    pool: "SUI / DBUSDC",
    baseSymbol: "SUI",
    quoteSymbol: "DBUSDC",
    side: "Long" as const,
    collateral: 500,
    collateralAsset: "DBUSDC",
    leverage: 3,
    currentPrice: 3.45,
    liqPrice: 2.28,
    risk: 1.2,
  },
  {
    id: "2",
    pool: "DEEP / SUI",
    baseSymbol: "DEEP",
    quoteSymbol: "SUI",
    side: "Short" as const,
    collateral: 250,
    collateralAsset: "SUI",
    leverage: 2,
    currentPrice: 0.042,
    liqPrice: 0.063,
    risk: 0.8,
  },
];

function ModifyPopover({ position, collateralPrice }: { position: (typeof mockPositions)[number]; collateralPrice: number }) {
  const [action, setAction] = useState("deposit");
  const [amount, setAmount] = useState("");

  const amountNum = parseFloat(amount) || 0;
  const delta = action === "deposit" ? amountNum : -amountNum;

  const newRisk = amountNum > 0
    ? calculateModifiedRiskRatio(
        position.collateral,
        delta,
        collateralPrice,
        position.risk
      )
    : position.risk;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
        >
          Modify
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Modify Collateral</h3>
            <p className="text-xs text-muted-foreground">
              {position.pool} — {position.side} {position.leverage}x
            </p>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Collateral</span>
            <span className="font-mono font-medium flex items-center gap-1.5">
              <CoinIcon symbol={position.collateralAsset} size={14} />
              {position.collateral.toLocaleString()} {position.collateralAsset}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Risk Ratio</span>
            <span className={`font-mono font-medium ${getRiskColor(position.risk)}`}>
              {position.risk.toFixed(2)}
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
            <Label className="text-xs">Amount ({position.collateralAsset})</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {amountNum > 0 && (
            <div className="flex justify-between text-xs items-center rounded-md bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">New Risk Ratio</span>
              <span className={`font-mono font-medium ${getRiskColor(newRisk)}`}>
                {newRisk.toFixed(2)}
              </span>
            </div>
          )}

          <Button size="sm" className="w-full">
            {action === "deposit" ? "Add Collateral" : "Withdraw Collateral"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DashboardPage() {
  const { getUsdPrice } = usePrices();
  const totalCollateral = mockPositions.reduce((acc, p) => acc + p.collateral * getUsdPrice(p.collateralAsset), 0);

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
            ${totalCollateral.toLocaleString()}
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
                        <PoolPairIcon baseSymbol={position.baseSymbol} quoteSymbol={position.quoteSymbol} size={18} />
                        <span className="font-medium">{position.pool}</span>
                        <span className="text-primary text-sm font-medium">
                          {position.leverage}x
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ModifyPopover position={position} collateralPrice={getUsdPrice(position.collateralAsset)} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          Close Position
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Collateral</p>
                        <p className="font-mono font-medium flex items-center gap-1.5">
                          <CoinIcon symbol={position.collateralAsset} size={14} />
                          {position.collateral.toLocaleString()}
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
                        <p className="text-muted-foreground">Risk Ratio</p>
                        <p className={`font-mono font-medium ${getRiskColor(position.risk)}`}>
                          {position.risk.toFixed(2)} ({getRiskLabel(position.risk)})
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
