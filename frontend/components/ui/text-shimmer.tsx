"use client";

import { cn } from "@/lib/utils";

interface TextShimmerProps {
  children: React.ReactNode;
  className?: string;
  shimmerWidth?: number;
}

export function TextShimmer({
  children,
  className,
  shimmerWidth = 100,
}: TextShimmerProps) {
  return (
    <span
      style={
        {
          "--shimmer-width": `${shimmerWidth}px`,
        } as React.CSSProperties
      }
      className={cn(
        "relative inline-block bg-clip-text text-transparent",
        "bg-[linear-gradient(90deg,transparent,hsl(var(--primary)),transparent)]",
        "bg-[length:var(--shimmer-width)_100%]",
        "bg-no-repeat",
        "animate-shimmer",
        className
      )}
    >
      <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground">
        {children}
      </span>
    </span>
  );
}

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
}

export function GradientText({ children, className }: GradientTextProps) {
  return (
    <span
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

interface SparkleTextProps {
  children: React.ReactNode;
  className?: string;
}

export function SparkleText({ children, className }: SparkleTextProps) {
  return (
    <span className={cn("relative inline-block", className)}>
      <span className="relative z-10">{children}</span>
      <span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent blur-xl animate-pulse"
        aria-hidden="true"
      />
    </span>
  );
}
