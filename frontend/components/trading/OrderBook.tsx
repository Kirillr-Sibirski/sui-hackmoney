"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockAsks = [
  { price: 3.4580, size: 1250.5, total: 4325.65 },
  { price: 3.4575, size: 890.2, total: 3075.15 },
  { price: 3.4570, size: 2100.0, total: 7259.70 },
  { price: 3.4565, size: 450.8, total: 1558.50 },
  { price: 3.4560, size: 1800.3, total: 6221.84 },
  { price: 3.4555, size: 670.1, total: 2315.49 },
  { price: 3.4550, size: 3200.0, total: 11056.00 },
  { price: 3.4545, size: 920.5, total: 3179.77 },
];

const mockBids = [
  { price: 3.4520, size: 1100.2, total: 3798.29 },
  { price: 3.4515, size: 2300.5, total: 7940.45 },
  { price: 3.4510, size: 890.0, total: 3071.39 },
  { price: 3.4505, size: 1650.8, total: 5696.94 },
  { price: 3.4500, size: 4200.0, total: 14490.00 },
  { price: 3.4495, size: 780.3, total: 2691.32 },
  { price: 3.4490, size: 1920.1, total: 6622.58 },
  { price: 3.4485, size: 560.9, total: 1933.52 },
];

export function OrderBook() {
  const maxTotal = Math.max(
    ...mockAsks.map((a) => a.total),
    ...mockBids.map((b) => b.total)
  );

  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-lg">Order Book</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <div className="grid grid-cols-3 text-xs text-muted-foreground px-2 pb-2">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>

        <div className="space-y-0.5">
          {mockAsks.reverse().map((ask, i) => (
            <div
              key={i}
              className="grid grid-cols-3 text-xs font-mono relative px-2 py-0.5"
            >
              <div
                className="absolute inset-0 bg-red-500/10"
                style={{ width: `${(ask.total / maxTotal) * 100}%`, right: 0, left: 'auto' }}
              />
              <span className="text-red-500 relative">{ask.price.toFixed(4)}</span>
              <span className="text-right relative">{ask.size.toFixed(1)}</span>
              <span className="text-right relative">{ask.total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="py-2 px-2 text-center border-y border-border my-2">
          <span className="text-lg font-bold font-mono">3.4521</span>
          <span className="text-xs text-muted-foreground ml-2">Spread: 0.07%</span>
        </div>

        <div className="space-y-0.5">
          {mockBids.map((bid, i) => (
            <div
              key={i}
              className="grid grid-cols-3 text-xs font-mono relative px-2 py-0.5"
            >
              <div
                className="absolute inset-0 bg-green-500/10"
                style={{ width: `${(bid.total / maxTotal) * 100}%`, right: 0, left: 'auto' }}
              />
              <span className="text-green-500 relative">{bid.price.toFixed(4)}</span>
              <span className="text-right relative">{bid.size.toFixed(1)}</span>
              <span className="text-right relative">{bid.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
