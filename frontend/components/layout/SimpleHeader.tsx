"use client";

import { Button } from "@/components/ui/button";
import { BalanceManager } from "@/components/wallet/BalanceManager";

export function SimpleHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <h1 className="text-xl font-semibold">
        <span className="relative">
          <span className="absolute top-0 left-0 w-2 h-0.5 bg-primary rounded-full" />
          O
        </span>
        shio
      </h1>
      <div className="flex items-center gap-3">
        <BalanceManager />
        <Button>Connect Wallet</Button>
      </div>
    </header>
  );
}
