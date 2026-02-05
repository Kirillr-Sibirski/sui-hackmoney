"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold">Ōshio</h1>

        <Select defaultValue="sui-usdc">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sui-usdc">SUI / USDC</SelectItem>
            <SelectItem value="eth-usdc">ETH / USDC</SelectItem>
            <SelectItem value="btc-usdc">BTC / USDC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="py-2">
        <CardContent className="flex items-center gap-4 p-0 px-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Trading Balance</p>
            <p className="font-mono font-medium">1,234.56 USDC</p>
          </div>
          <Button variant="outline" size="sm">
            Top Up
          </Button>
          <Button size="sm">
            <Wallet className="w-4 h-4 mr-2" />
            Connect
          </Button>
        </CardContent>
      </Card>
    </header>
  );
}
