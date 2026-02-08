"use client";

import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { LayoutDashboard, TrendingUp, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { isAdmin } from "@/lib/admin";

const AdminLink = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) => {
      const { useCurrentAccount } = dappKit;
      return function AdminLinkInner() {
        const account = useCurrentAccount();
        if (!isAdmin(account?.address)) return null;
        return (
          <AdminButton />
        );
      };
    }),
  { ssr: false }
);

function AdminButton() {
  const pathname = usePathname();
  return (
    <Button
      variant={pathname === "/admin" ? "secondary" : "ghost"}
      size="sm"
      asChild
    >
      <Link href="/admin" className="gap-1.5">
        <Shield className="w-4 h-4" />
        Admin
      </Link>
    </Button>
  );
}

export function SimpleHeader() {
  const pathname = usePathname();

  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <Link href="/">
          <h1 className="text-xl font-semibold">
            <span className="relative">
              <span className="absolute top-0 left-0 w-2 h-0.5 bg-primary rounded-full" />
              O
            </span>
            shio
          </h1>
        </Link>
        <nav className="flex items-center gap-1">
          <Button
            variant={pathname === "/" ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link href="/" className="gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Trade
            </Link>
          </Button>
          <Button
            variant={pathname === "/dashboard" ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link href="/dashboard" className="gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
          <AdminLink />
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <ConnectWalletButton />
      </div>
    </header>
  );
}
