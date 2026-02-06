"use client";

import { cn } from "@/lib/utils";

interface PulseDotProps {
  className?: string;
  color?: string;
}

export function PulseDot({ className, color = "bg-primary" }: PulseDotProps) {
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5", className)}>
      <span
        className={cn("absolute inline-flex h-full w-full rounded-full", color)}
        style={{
          animation: "dot-ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        }}
      />
      <span
        className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)}
        style={{
          animation: "dot-breathe 2.5s ease-in-out infinite",
        }}
      />
    </span>
  );
}
