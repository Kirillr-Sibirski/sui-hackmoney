"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TradeForm() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");

  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-lg">Place Order</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
          <TabsList className="w-full">
            <TabsTrigger
              value="buy"
              className="flex-1 data-[state=active]:bg-green-500 data-[state=active]:text-white"
            >
              Buy / Long
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              className="flex-1 data-[state=active]:bg-red-500 data-[state=active]:text-white"
            >
              Sell / Short
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "limit" | "market")}>
          <TabsList className="w-full">
            <TabsTrigger value="limit" className="flex-1">
              Limit
            </TabsTrigger>
            <TabsTrigger value="market" className="flex-1">
              Market
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              Leverage
            </label>
            <Select defaultValue="5">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="3">3x</SelectItem>
                <SelectItem value="5">5x</SelectItem>
                <SelectItem value="10">10x</SelectItem>
                <SelectItem value="20">20x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              Amount (SUI)
            </label>
            <Input type="number" placeholder="0.00" className="font-mono" />
          </div>

          {orderType === "limit" && (
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">
                Price (USDC)
              </label>
              <Input
                type="number"
                placeholder="0.0000"
                defaultValue="3.4521"
                className="font-mono"
              />
            </div>
          )}

          <div className="pt-2 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Order Value</span>
              <span className="font-mono">0.00 USDC</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Available Balance</span>
              <span className="font-mono">1,234.56 USDC</span>
            </div>
          </div>

          <Button
            className={`w-full ${
              side === "buy"
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {side === "buy" ? "Buy / Long" : "Sell / Short"} SUI
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
