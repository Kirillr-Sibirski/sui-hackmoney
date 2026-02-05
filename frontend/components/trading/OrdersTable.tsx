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

const mockOrders = [
  {
    id: "ord-1",
    symbol: "SUI/USDC",
    side: "Buy",
    type: "Limit",
    size: 200,
    price: 3.4000,
    filled: 0,
    status: "Open",
  },
  {
    id: "ord-2",
    symbol: "SUI/USDC",
    side: "Sell",
    type: "Limit",
    size: 150,
    price: 3.5500,
    filled: 0,
    status: "Open",
  },
];

export function OrdersTable() {
  if (mockOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No open orders
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Filled</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockOrders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.symbol}</TableCell>
            <TableCell>
              <span
                className={
                  order.side === "Buy" ? "text-green-500" : "text-red-500"
                }
              >
                {order.side}
              </span>
            </TableCell>
            <TableCell>{order.type}</TableCell>
            <TableCell className="text-right font-mono">{order.size}</TableCell>
            <TableCell className="text-right font-mono">
              {order.price.toFixed(4)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {order.filled} / {order.size}
            </TableCell>
            <TableCell>
              <span className="text-yellow-500">{order.status}</span>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
