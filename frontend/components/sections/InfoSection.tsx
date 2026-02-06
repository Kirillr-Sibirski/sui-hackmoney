"use client";

import { SpotlightCard } from "@/components/ui/spotlight-card";
import { PulseDot } from "@/components/ui/pulse-dot";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const stats = [
  { label: "DeepBook TVL", value: "$50M+", highlight: false },
  { label: "Sui TPS", value: "297K", highlight: false },
  { label: "Time to Finality", value: "390ms", highlight: true },
  { label: "Max Leverage", value: "5x", highlight: false },
];

export function InfoSection() {
  return (
    <section className="w-full max-w-5xl mx-auto px-6 py-24">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        <div className="space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Margin trading,
            <br />
            simplified.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Ōshio brings leveraged trading to Sui with the simplest interface
            possible. No complex order books, no overwhelming charts—just pick
            your direction and go.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Built on DeepBook V3, Sui&apos;s native order book, with sub-second
            finality and minimal fees.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="group" asChild>
              <a href="https://deepbook.tech/margin" target="_blank" rel="noopener noreferrer">
                Learn more about DeepBook Margin
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </div>

        <SpotlightCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <PulseDot />
            <span className="text-sm text-primary font-medium">
              Platform Stats
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="space-y-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p
                  className={`text-2xl font-bold ${
                    stat.highlight ? "text-primary" : ""
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </SpotlightCard>
      </div>

      <div className="mt-24 space-y-12">
        <h3 className="text-3xl font-bold tracking-tight text-center">
          Why Sui?
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <SpotlightCard className="p-6 space-y-3">
            <h4 className="font-semibold text-lg">Parallel Execution</h4>
            <p className="text-sm text-muted-foreground">
              Sui processes transactions in parallel, enabling unprecedented
              throughput without compromising security.
            </p>
          </SpotlightCard>
          <SpotlightCard className="p-6 space-y-3">
            <h4 className="font-semibold text-lg">Sub-Second Finality</h4>
            <p className="text-sm text-muted-foreground">
              Transactions finalize in under 400ms. Your trades execute
              instantly with immediate confirmation.
            </p>
          </SpotlightCard>
          <SpotlightCard className="p-6 space-y-3">
            <h4 className="font-semibold text-lg">DeepBook V3</h4>
            <p className="text-sm text-muted-foreground">
              Native on-chain order book built by Mysten Labs. Deep liquidity,
              minimal slippage, and trustless execution.
            </p>
          </SpotlightCard>
        </div>
        <div className="flex justify-center pt-4">
          <Button variant="outline" className="group" asChild>
            <a href="https://www.sui.io/" target="_blank" rel="noopener noreferrer">
              Learn more about Sui
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
