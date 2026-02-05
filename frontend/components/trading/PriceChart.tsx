"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PriceChart() {
  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">SUI / USDC</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-2xl font-bold font-mono">3.4521</span>
            <span className="text-green-500">+2.34%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <div className="w-full h-full bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground">
          TradingView Chart Placeholder
        </div>
      </CardContent>
    </Card>
  );
}
