"use client";

import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";

const mockPositions = [
  {
    id: "1",
    pool: "SUI / USDC",
    side: "Long",
    size: 500,
    leverage: 3,
    pnl: 16.05,
  },
  {
    id: "2",
    pool: "ETH / USDC",
    side: "Short",
    size: 250,
    leverage: 2,
    pnl: -8.25,
  },
];

export function PositionsList() {
  if (mockPositions.length === 0) {
    return null;
  }

  return (
    <SpotlightCard className="w-full max-w-md">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Positions</h2>
          <p className="text-sm text-muted-foreground">Your open positions</p>
        </div>

        <div className="space-y-3">
          {mockPositions.map((position) => (
            <div
              key={position.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div>
                <p className="font-medium">{position.pool}</p>
                <p className="text-sm text-muted-foreground">
                  {position.side} · {position.leverage}x · ${position.size}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm">
                  {position.pnl >= 0 ? "+" : ""}
                  {position.pnl.toFixed(2)}
                </span>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SpotlightCard>
  );
}
