"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockPositions = [
  {
    id: "1",
    symbol: "SUI/USDC",
    side: "Long",
    size: 500,
    leverage: 5,
    entryPrice: 3.4200,
    markPrice: 3.4521,
    pnl: 16.05,
    pnlPercent: 4.69,
    liqPrice: 2.7360,
  },
  {
    id: "2",
    symbol: "ETH/USDC",
    side: "Short",
    size: 0.5,
    leverage: 10,
    entryPrice: 3850.00,
    markPrice: 3820.50,
    pnl: 14.75,
    pnlPercent: 1.53,
    liqPrice: 4235.00,
  },
];

export function PositionsTable() {
  if (mockPositions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No open positions
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead>Side</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead className="text-right">Leverage</TableHead>
          <TableHead className="text-right">Entry Price</TableHead>
          <TableHead className="text-right">Mark Price</TableHead>
          <TableHead className="text-right">PnL</TableHead>
          <TableHead className="text-right">Liq. Price</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockPositions.map((position) => (
          <TableRow key={position.id}>
            <TableCell className="font-medium">{position.symbol}</TableCell>
            <TableCell>
              <span
                className={
                  position.side === "Long" ? "text-green-500" : "text-red-500"
                }
              >
                {position.side}
              </span>
            </TableCell>
            <TableCell className="text-right font-mono">{position.size}</TableCell>
            <TableCell className="text-right font-mono">{position.leverage}x</TableCell>
            <TableCell className="text-right font-mono">
              {position.entryPrice.toFixed(4)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {position.markPrice.toFixed(4)}
            </TableCell>
            <TableCell className="text-right">
              <span
                className={`font-mono ${
                  position.pnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {position.pnl >= 0 ? "+" : ""}
                {position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
              </span>
            </TableCell>
            <TableCell className="text-right font-mono">
              {position.liqPrice.toFixed(4)}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="destructive" size="sm">
                Close
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
