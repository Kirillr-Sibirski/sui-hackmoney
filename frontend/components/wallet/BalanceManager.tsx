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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";

export function BalanceManager() {
  const [action, setAction] = useState("deposit");
  const [amount, setAmount] = useState("");

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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trading Balance</span>
              <span className="font-medium">1,234.56 USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Wallet Balance</span>
              <span className="font-medium">5,000.00 USDC</span>
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
            <Label>Amount (USDC)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {["100", "500", "1000"].map((val) => (
                <Button
                  key={val}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAmount(val)}
                >
                  {val}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() =>
                  setAmount(action === "deposit" ? "5000" : "1234.56")
                }
              >
                Max
              </Button>
            </div>
          </div>

          <Button className="w-full">
            {action === "deposit" ? "Deposit to Margin" : "Withdraw to Wallet"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
