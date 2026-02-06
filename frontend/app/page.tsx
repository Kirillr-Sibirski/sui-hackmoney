import { SimpleHeader } from "@/components/layout/SimpleHeader";
import { TradeCard } from "@/components/trading/TradeCard";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { InfoSection } from "@/components/sections/InfoSection";
import { FloatingIcons } from "@/components/ui/floating-icons";
import { GradientText, SparkleText } from "@/components/ui/text-shimmer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative">
      <FloatingIcons />
      <SimpleHeader />

      <main className="relative z-10 flex flex-col items-center justify-center px-4 pt-12 pb-32 gap-8 min-h-[calc(100vh-65px)]">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            <SparkleText>Simple</SparkleText>{" "}
            <GradientText>Margin Trading</GradientText>
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Leverage up to 5x on Sui. No complexity.{" "}
            <span className="text-primary">Powered by DeepBook.</span>
          </p>
        </div>

        <TradeCard />
      </main>

      <ScrollIndicator targetId="learn-more" />

      <div id="learn-more" className="relative z-10">
        <InfoSection />
      </div>
    </div>
  );
}
