"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SimpleHeader } from "@/components/layout/SimpleHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FloatingIcons } from "@/components/ui/floating-icons";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Loader2, Copy, Check, Shield } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import pools from "@/config/pools.json";
import referralsConfig from "@/config/referrals.json";

const referrals = referralsConfig.referrals as Record<string, string | null>;

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
                  [poolId]: { loading: false, error: "Multiplier must be 0.1–2.0" },
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
                    result: referralAddr ?? "Minted (could not extract ID — check explorer)",
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

            return (
              <main className="relative z-10 max-w-3xl mx-auto px-8 lg:px-16 py-8">
                <div className="mb-8">
                  <h1 className="text-2xl font-bold">Admin</h1>
                  <p className="text-muted-foreground">Manage referrals and claim rewards</p>
                </div>

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
                              <Label className="text-xs">Multiplier (0.1–2.0)</Label>
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

                {/* Claim Rewards */}
                <SpotlightCard className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Claim Referral Rewards</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Claim accumulated taker fee rewards for each pool referral.
                  </p>

                  <div className="space-y-4">
                    {pools.pools
                      .filter((pool) => referrals[pool.id])
                      .map((pool) => {
                        const state = claimStates[pool.id];
                        return (
                          <div key={pool.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{pool.name}</span>
                              <Button
                                size="sm"
                                onClick={() => handleClaim(pool.id)}
                                disabled={state?.loading}
                              >
                                {state?.loading ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Claiming...
                                  </>
                                ) : (
                                  "Claim Rewards"
                                )}
                              </Button>
                            </div>
                            {state?.result && (
                              <p className="text-xs text-emerald-500 mt-2">{state.result}</p>
                            )}
                            {state?.error && (
                              <p className="text-xs text-rose-500 mt-2">{state.error}</p>
                            )}
                          </div>
                        );
                      })}
                    {pools.pools.filter((pool) => referrals[pool.id]).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No referrals configured. Mint referrals above, then update <code className="text-xs bg-muted px-1 py-0.5 rounded">referrals.json</code>.
                      </p>
                    )}
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
