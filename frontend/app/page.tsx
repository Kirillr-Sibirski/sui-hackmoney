import { SimpleHeader } from "@/components/layout/SimpleHeader";
import { TradeCard } from "@/components/trading/TradeCard";
import { PositionsList } from "@/components/trading/PositionsList";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { InfoSection } from "@/components/sections/InfoSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />

      <main className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-4 py-16 gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Simple Margin Trading
          </h1>
          <p className="text-muted-foreground">
            Leverage up to 5x on Sui. No complexity.
          </p>
        </div>

        <TradeCard />
        <PositionsList />

        <div className="mt-8">
          <ScrollIndicator targetId="learn-more" />
        </div>
      </main>

      <div id="learn-more">
        <InfoSection />
      </div>
    </div>
  );
}
