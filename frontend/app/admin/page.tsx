"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { SimpleHeader } from "@/components/layout/SimpleHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FloatingIcons } from "@/components/ui/floating-icons";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Loader2, Copy, Check, Shield, RefreshCw } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import pools from "@/config/pools.json";
import referralsConfig from "@/config/referrals.json";

const referrals = referralsConfig.referrals as Record<string, string | null>;

type PoolBalances = { base: number; quote: number; deep: number };

const AdminInner = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((dappKit) =>
      import("@mysten/deepbook-v3").then((deepbookMod) =>
        import("@/lib/deepbook/transactions").then((txMod) => {
          const { useCurrentAccount, useCurrentClient, useDAppKit } = dappKit;
          const { DeepBookClient } = deepbookMod;
          const { extractReferralAddress, formatTxError } = txMod;

          return function AdminWithWallet() {
            const account = useCurrentAccount();
            const suiClient = useCurrentClient();
            const dAppKitInstance = useDAppKit();

            const [mintStates, setMintStates] = useState<
              Record<string, { loading: boolean; result?: string; error?: string }>
            >({});
            const [multipliers, setMultipliers] = useState<Record<string, string>>({});
            const [claimStates, setClaimStates] = useState<
              Record<string, { loading: boolean; result?: string; error?: string }>
            >({});
            const [copied, setCopied] = useState<string | null>(null);

            // Reward balances per pool
            const [balances, setBalances] = useState<Record<string, PoolBalances | null>>({});
            const [balancesLoading, setBalancesLoading] = useState(false);

            const fetchBalances = useCallback(async () => {
              if (!suiClient || !account) return;

              setBalancesLoading(true);
              const client = new DeepBookClient({
                client: suiClient,
                network: "mainnet",
                address: account.address,
              });

              const results: Record<string, PoolBalances | null> = {};
              for (const pool of pools.pools) {
                const refId = referrals[pool.id];
                if (!refId) {
                  results[pool.id] = null;
                  continue;
                }
                try {
                  const bal = await client.getPoolReferralBalances(pool.id, refId);
                  results[pool.id] = bal;
                } catch (err) {
                  console.warn(`Failed to fetch balances for ${pool.id}:`, err);
                  results[pool.id] = null;
                }
              }
              setBalances(results);
              setBalancesLoading(false);
            }, [suiClient, account]);

            // Auto-fetch balances on mount
            useEffect(() => {
              if (account && isAdmin(account.address)) {
                fetchBalances();
              }
            }, [account, fetchBalances]);

            if (!account) {
              return (
                <main className="relative z-10 max-w-3xl mx-auto px-8 lg:px-16 py-8">
                  <div className="text-center py-24 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Connect your wallet to access admin</p>
                  </div>
                </main>
              );
            }

            if (!isAdmin(account.address)) {
              return (
                <main className="relative z-10 max-w-3xl mx-auto px-8 lg:px-16 py-8">
                  <div className="text-center py-24 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Access denied</p>
                    <p className="text-sm mt-2">This page is only accessible to the admin wallet.</p>
                  </div>
                </main>
              );
            }

            const handleMint = async (poolId: string) => {
              if (!suiClient || !account) return;

              const multiplier = parseFloat(multipliers[poolId] || "1.0");
              if (multiplier < 0.1 || multiplier > 2.0) {
                setMintStates((s) => ({
                  ...s,
                  [poolId]: { loading: false, error: "Multiplier must be 0.1-2.0" },
                }));
                return;
              }

              setMintStates((s) => ({ ...s, [poolId]: { loading: true } }));

              try {
                const client = new DeepBookClient({
                  client: suiClient,
                  network: "mainnet",
                  address: account.address,
                });

                const tx = new (await import("@mysten/sui/transactions")).Transaction();
                client.deepBook.mintReferral(poolId, multiplier)(tx);

                const signResult = await dAppKitInstance.signAndExecuteTransaction({
                  transaction: tx,
                });

                const digest = (signResult as any).Transaction?.digest;
                const fullResult = await suiClient.core.getTransaction({
                  digest,
                  include: { effects: true, objectTypes: true },
                });

                const referralAddr = extractReferralAddress(fullResult as any);
                setMintStates((s) => ({
                  ...s,
                  [poolId]: {
                    loading: false,
                    result: referralAddr ?? "Minted (could not extract ID \u2014 check explorer)",
                  },
                }));
              } catch (err: any) {
                console.error("Mint referral failed:", err);
                setMintStates((s) => ({
                  ...s,
                  [poolId]: { loading: false, error: formatTxError(err) },
                }));
              }
            };

            const handleClaim = async (poolId: string) => {
              const referralId = referrals[poolId];
              if (!referralId || !suiClient || !account) return;

              setClaimStates((s) => ({ ...s, [poolId]: { loading: true } }));

              try {
                const client = new DeepBookClient({
                  client: suiClient,
                  network: "mainnet",
                  address: account.address,
                });

                const tx = new (await import("@mysten/sui/transactions")).Transaction();
                const { baseRewards, quoteRewards, deepRewards } =
                  client.deepBook.claimPoolReferralRewards(poolId, referralId)(tx);

                tx.transferObjects(
                  [baseRewards, quoteRewards, deepRewards],
                  account.address
                );

                await dAppKitInstance.signAndExecuteTransaction({
                  transaction: tx,
                });

                setClaimStates((s) => ({
                  ...s,
                  [poolId]: { loading: false, result: "Rewards claimed!" },
                }));

                // Refresh balances after claim
                fetchBalances();
              } catch (err: any) {
                console.error("Claim rewards failed:", err);
                setClaimStates((s) => ({
                  ...s,
                  [poolId]: { loading: false, error: formatTxError(err) },
                }));
              }
            };

            const handleCopy = (text: string, key: string) => {
              navigator.clipboard.writeText(text);
              setCopied(key);
              setTimeout(() => setCopied(null), 2000);
            };

            const formatAmount = (amount: number) => {
              if (amount === 0) return "0";
              if (amount < 0.000001) return amount.toExponential(2);
              if (amount < 0.01) return amount.toPrecision(3);
              if (amount < 1) return amount.toFixed(4);
              return amount.toFixed(4);
            };

            const activeReferralPools = pools.pools.filter((pool) => referrals[pool.id]);

            return (
              <main className="relative z-10 max-w-3xl mx-auto px-8 lg:px-16 py-8">
                <div className="mb-8">
                  <h1 className="text-2xl font-bold">Admin</h1>
                  <p className="text-muted-foreground">Manage referrals and claim rewards</p>
                </div>

                {/* Referral Rewards Overview */}
                {activeReferralPools.length > 0 && (
                  <SpotlightCard className="mb-8 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Referral Rewards</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchBalances}
                        disabled={balancesLoading}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${balancesLoading ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {activeReferralPools.map((pool) => {
                        const bal = balances[pool.id];
                        const claimState = claimStates[pool.id];
                        const hasRewards = bal && (bal.base > 0 || bal.quote > 0 || bal.deep > 0);

                        return (
                          <div key={pool.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{pool.name}</span>
                              <Button
                                size="sm"
                                onClick={() => handleClaim(pool.id)}
                                disabled={claimState?.loading || !hasRewards}
                              >
                                {claimState?.loading ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Claiming...
                                  </>
                                ) : (
                                  "Claim Rewards"
                                )}
                              </Button>
                            </div>

                            {bal ? (
                              <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-md bg-muted/50 px-3 py-2">
                                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                                    <CoinIcon symbol={pool.baseAsset} size={12} />
                                    {pool.baseAsset}
                                  </p>
                                  <p className={`font-mono text-sm font-medium ${bal.base > 0 ? "text-emerald-500" : ""}`}>
                                    {formatAmount(bal.base)}
                                  </p>
                                </div>
                                <div className="rounded-md bg-muted/50 px-3 py-2">
                                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                                    <CoinIcon symbol={pool.quoteAsset} size={12} />
                                    {pool.quoteAsset}
                                  </p>
                                  <p className={`font-mono text-sm font-medium ${bal.quote > 0 ? "text-emerald-500" : ""}`}>
                                    {formatAmount(bal.quote)}
                                  </p>
                                </div>
                                <div className="rounded-md bg-muted/50 px-3 py-2">
                                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                                    <CoinIcon symbol="DEEP" size={12} />
                                    DEEP
                                  </p>
                                  <p className={`font-mono text-sm font-medium ${bal.deep > 0 ? "text-emerald-500" : ""}`}>
                                    {formatAmount(bal.deep)}
                                  </p>
                                </div>
                              </div>
                            ) : balancesLoading ? (
                              <div className="grid grid-cols-3 gap-3">
                                {[0, 1, 2].map((i) => (
                                  <div key={i} className="rounded-md bg-muted/50 px-3 py-2">
                                    <div className="h-3 w-12 rounded bg-muted animate-pulse mb-2" />
                                    <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Failed to load balances</p>
                            )}

                            {claimState?.result && (
                              <p className="text-xs text-emerald-500">{claimState.result}</p>
                            )}
                            {claimState?.error && (
                              <p className="text-xs text-rose-500">{claimState.error}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SpotlightCard>
                )}

                {/* Mint Referrals */}
                <SpotlightCard className="mb-8 p-6">
                  <h2 className="text-lg font-semibold mb-4">Mint Pool Referrals</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Mint a DeepBookPoolReferral for each pool to earn a share of taker fees.
                    After minting, copy the object ID into <code className="text-xs bg-muted px-1 py-0.5 rounded">config/referrals.json</code> and redeploy.
                  </p>

                  <div className="space-y-4">
                    {pools.pools.map((pool) => {
                      const state = mintStates[pool.id];
                      const existingReferral = referrals[pool.id];

                      return (
                        <div key={pool.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{pool.name}</span>
                            {existingReferral && (
                              <span className="text-xs text-emerald-500 font-mono">
                                Active
                              </span>
                            )}
                          </div>

                          {existingReferral && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">ID:</span>
                              <code className="font-mono text-muted-foreground truncate max-w-[300px]">
                                {existingReferral}
                              </code>
                              <button
                                onClick={() => handleCopy(existingReferral, `ref-${pool.id}`)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {copied === `ref-${pool.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}

                          <div className="flex items-end gap-3">
                            <div className="space-y-1.5 flex-1">
                              <Label className="text-xs">Multiplier (0.1-2.0)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="2.0"
                                placeholder="1.0"
                                value={multipliers[pool.id] ?? ""}
                                onChange={(e) =>
                                  setMultipliers((s) => ({ ...s, [pool.id]: e.target.value }))
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleMint(pool.id)}
                              disabled={state?.loading}
                            >
                              {state?.loading ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  Minting...
                                </>
                              ) : (
                                "Mint Referral"
                              )}
                            </Button>
                          </div>

                          {state?.result && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-emerald-500">Minted:</span>
                              <code className="font-mono text-emerald-500 truncate max-w-[300px]">
                                {state.result}
                              </code>
                              {state.result.startsWith("0x") && (
                                <button
                                  onClick={() => handleCopy(state.result!, `mint-${pool.id}`)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {copied === `mint-${pool.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          )}

                          {state?.error && (
                            <p className="text-xs text-rose-500">{state.error}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SpotlightCard>
              </main>
            );
          };
        })
      )
    ),
  {
    ssr: false,
    loading: () => (
      <main className="relative z-10 max-w-3xl mx-auto px-8 lg:px-16 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-muted-foreground">Manage referrals and claim rewards</p>
        </div>
        <SpotlightCard className="p-6">
          <div className="h-5 w-48 rounded bg-muted/50 animate-pulse mb-6" />
          <div className="h-32 rounded bg-muted/50 animate-pulse" />
        </SpotlightCard>
      </main>
    ),
  }
);

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background relative">
      <FloatingIcons />
      <SimpleHeader />
      <AdminInner />
    </div>
  );
}
