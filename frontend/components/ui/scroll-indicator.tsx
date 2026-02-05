"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface ScrollIndicatorProps {
  targetId: string;
}

export function ScrollIndicator({ targetId }: ScrollIndicatorProps) {
  const handleClick = () => {
    const element = document.getElementById(targetId);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="text-sm">Scroll to learn more</span>
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <ChevronDown className="w-5 h-5" />
      </motion.div>
    </button>
  );
}
