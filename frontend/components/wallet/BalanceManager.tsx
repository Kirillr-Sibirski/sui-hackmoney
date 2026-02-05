"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";

export function BalanceManager() {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Wallet className="w-4 h-4 mr-2" />
          Manage
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Trading Account</SheetTitle>
          <SheetDescription>
            Manage your trading balance
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trading Balance</span>
              <span className="font-medium">1,234.56 USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Wallet Balance</span>
              <span className="font-medium">5,000.00 USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">In Positions</span>
              <span className="font-medium">750.00 USDC</span>
            </div>
          </div>

          <Separator />

          <Tabs defaultValue="deposit">
            <TabsList className="w-full">
              <TabsTrigger value="deposit" className="flex-1">
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="flex-1">
                Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Amount (USDC)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDepositAmount("100")}
                  >
                    100
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDepositAmount("500")}
                  >
                    500
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDepositAmount("1000")}
                  >
                    1000
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDepositAmount("5000")}
                  >
                    Max
                  </Button>
                </div>
              </div>
              <Button className="w-full">Deposit to Trading Account</Button>
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Amount (USDC)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount("100")}
                  >
                    100
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount("500")}
                  >
                    500
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount("1234.56")}
                  >
                    Max
                  </Button>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                Withdraw to Wallet
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
