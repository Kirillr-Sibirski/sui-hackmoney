"use client";

import { useState } from "react";
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

export function TradeCard() {
  const [side, setSide] = useState("long");
  const [leverage, setLeverage] = useState([2]);

  return (
    <SpotlightCard className="w-full max-w-md">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Trade</h2>
          <p className="text-sm text-muted-foreground">
            Open a leveraged position
          </p>
        </div>

        <div className="space-y-2">
          <Label>Pool</Label>
          <Select defaultValue="sui-usdc">
            <SelectTrigger>
              <SelectValue placeholder="Select pool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sui-usdc">SUI / USDC</SelectItem>
              <SelectItem value="eth-usdc">ETH / USDC</SelectItem>
              <SelectItem value="btc-usdc">BTC / USDC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Direction</Label>
          <Tabs value={side} onValueChange={setSide}>
            <TabsList className="w-full">
              <TabsTrigger
                value="long"
                className="flex-1 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-500"
              >
                Long
              </TabsTrigger>
              <TabsTrigger
                value="short"
                className="flex-1 data-[state=active]:bg-rose-600/20 data-[state=active]:text-rose-500"
              >
                Short
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label>Amount (USDC)</Label>
          <Input type="number" placeholder="0.00" />
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

        <Button className="w-full">Open Position</Button>
      </div>
    </SpotlightCard>
  );
}
