"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Sparkles } from "lucide-react";

// Available assets for deposit/withdraw
const assets = [
  { symbol: "USDC", name: "USD Coin", balance: 5000, tradingBalance: 1234.56 },
  { symbol: "SUI", name: "Sui", balance: 1500, tradingBalance: 0 },
  { symbol: "ETH", name: "Ethereum", balance: 2.5, tradingBalance: 0 },
  { symbol: "BTC", name: "Bitcoin", balance: 0.15, tradingBalance: 0 },
  { symbol: "DEEP", name: "DeepBook", balance: 50000, tradingBalance: 0, cheaper: true },
];

export function BalanceManager() {
  const [action, setAction] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("USDC");

  const currentAsset = assets.find((a) => a.symbol === selectedAsset) || assets[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Wallet className="w-4 h-4 mr-2" />
          Manage
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Margin Manager</h3>
            <p className="text-sm text-muted-foreground">
              Manage your trading balance
            </p>
          </div>

          <div className="space-y-2">
            <Label>Asset</Label>
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger>
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.symbol} value={asset.symbol}>
                    <span className="flex items-center gap-2">
                      {asset.symbol}
                      {asset.cheaper && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <Sparkles className="w-3 h-3" />
                          Lower fees
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trading Balance</span>
              <span className="font-medium">
                {currentAsset.tradingBalance.toLocaleString()} {currentAsset.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Wallet Balance</span>
              <span className="font-medium">
                {currentAsset.balance.toLocaleString()} {currentAsset.symbol}
              </span>
            </div>
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
                Deposit
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

          <div className="space-y-3">
            <Label>Amount ({currentAsset.symbol})</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {["25%", "50%", "75%"].map((pct) => (
                <Button
                  key={pct}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const maxVal = action === "deposit" ? currentAsset.balance : currentAsset.tradingBalance;
                    const percentage = parseInt(pct) / 100;
                    setAmount((maxVal * percentage).toString());
                  }}
                >
                  {pct}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() =>
                  setAmount(
                    action === "deposit"
                      ? currentAsset.balance.toString()
                      : currentAsset.tradingBalance.toString()
                  )
                }
              >
                Max
              </Button>
            </div>
          </div>

          <Button className="w-full">
            {action === "deposit" ? `Deposit ${currentAsset.symbol}` : `Withdraw ${currentAsset.symbol}`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
