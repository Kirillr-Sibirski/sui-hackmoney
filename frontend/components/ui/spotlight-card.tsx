"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
}

export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = divRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spot-opacity", "1");
  }, []);

  const handleMouseLeave = useCallback(() => {
    divRef.current?.style.setProperty("--spot-opacity", "0");
  }, []);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ "--spot-opacity": "0" } as React.CSSProperties}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-8",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: "var(--spot-opacity)",
          background:
            "radial-gradient(600px circle at var(--spot-x, 0px) var(--spot-y, 0px), rgba(255,255,255,.1), transparent 40%)",
        }}
      />
      {children}
    </div>
  );
}
