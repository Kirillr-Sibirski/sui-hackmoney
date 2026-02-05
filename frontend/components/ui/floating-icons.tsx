"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const icons = [
  { x: "10%", y: "20%", size: 80, delay: 0, duration: 20 },
  { x: "85%", y: "15%", size: 60, delay: 2, duration: 25 },
  { x: "75%", y: "70%", size: 70, delay: 1, duration: 22 },
  { x: "15%", y: "75%", size: 50, delay: 3, duration: 28 },
  { x: "50%", y: "85%", size: 65, delay: 0.5, duration: 24 },
  { x: "90%", y: "45%", size: 45, delay: 1.5, duration: 26 },
];

export function FloatingIcons() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {icons.map((icon, i) => (
        <motion.div
          key={i}
          className="absolute opacity-[0.08] blur-[2px]"
          style={{ left: icon.x, top: icon.y }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: icon.duration,
            repeat: Infinity,
            delay: icon.delay,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/sui-logo.svg"
            alt=""
            width={icon.size}
            height={icon.size}
          />
        </motion.div>
      ))}
    </div>
  );
}
