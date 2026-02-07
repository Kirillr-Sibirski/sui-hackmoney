"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Wallet, LogOut, Copy, ExternalLink, Check } from "lucide-react";
import { useState, useEffect } from "react";

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Client-only component that uses dapp-kit hooks
const ConnectWalletButtonClient = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((mod) => {
      const {
        useCurrentAccount,
        useCurrentWallet,
        useDAppKit,
        ConnectButton,
      } = mod;

      return function WalletButton() {
        const account = useCurrentAccount();
        const wallet = useCurrentWallet();
        const dAppKit = useDAppKit();
        const [copied, setCopied] = useState(false);

        const copyAddress = async () => {
          if (account?.address) {
            await navigator.clipboard.writeText(account.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        };

        // Not connected - show connect button
        if (!account) {
          return <ConnectButton />;
        }

        // Connected - show wallet info popover
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Wallet className="w-4 h-4" />
                {truncateAddress(account.address)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Connected Wallet</h3>
                  <p className="text-sm text-muted-foreground">{wallet?.name}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Address</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-mono">
                        {truncateAddress(account.address)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={copyAddress}
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <span className="text-sm font-medium text-primary">Mainnet</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    asChild
                  >
                    <a
                      href={`https://suiscan.xyz/mainnet/account/${account.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Explorer
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-rose-500 hover:text-rose-500 hover:bg-rose-500/10"
                    onClick={() => dAppKit.disconnectWallet()}
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      };
    }),
  {
    ssr: false,
    loading: () => (
      <Button disabled>
        <Wallet className="w-4 h-4 mr-2" />
        Loading...
      </Button>
    ),
  }
);

export function ConnectWalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button disabled>
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }

  return <ConnectWalletButtonClient />;
}
