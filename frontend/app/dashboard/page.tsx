import { SimpleHeader } from "@/components/layout/SimpleHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const mockPositions = [
  {
    id: "1",
    pool: "SUI / USDC",
    side: "Long",
    size: 500,
    leverage: 3,
    currentPrice: 3.45,
    liqPrice: 2.28,
    risk: 1.2,
  },
  {
    id: "2",
    pool: "ETH / USDC",
    side: "Short",
    size: 250,
    leverage: 2,
    currentPrice: 3820.5,
    liqPrice: 5775.0,
    risk: 0.8,
  },
];

function getRiskStatus(risk: number) {
  if (risk <= 1.0) return { label: "Safe", color: "text-emerald-500" };
  if (risk <= 2.0) return { label: "Moderate", color: "text-yellow-500" };
  return { label: "High", color: "text-rose-500" };
}

export default function DashboardPage() {
  const totalSize = mockPositions.reduce((acc, p) => acc + p.size, 0);

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your positions
          </p>
        </div>

        {/* Stats */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Position Size</p>
            <p className="text-2xl font-bold">${totalSize.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Positions */}
        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {mockPositions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No open positions</p>
                <Button className="mt-4" asChild>
                  <Link href="/">Open a trade</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {mockPositions.map((position) => {
                  const riskStatus = getRiskStatus(position.risk);
                  return (
                    <div
                      key={position.id}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              position.side === "Long"
                                ? "bg-emerald-500/20 text-emerald-500"
                                : "bg-rose-500/20 text-rose-500"
                            }`}
                          >
                            {position.side}
                          </span>
                          <span className="font-medium">{position.pool}</span>
                          <span className="text-muted-foreground text-sm">
                            {position.leverage}x
                          </span>
                        </div>
                        <Button variant="outline" size="sm">
                          Close
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Size</p>
                          <p className="font-mono font-medium">${position.size}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Current Price</p>
                          <p className="font-mono font-medium">
                            ${position.currentPrice.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Liq. Price</p>
                          <p className="font-mono font-medium">
                            ${position.liqPrice.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Risk</p>
                          <p className={`font-mono font-medium ${riskStatus.color}`}>
                            {position.risk.toFixed(1)} ({riskStatus.label})
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
