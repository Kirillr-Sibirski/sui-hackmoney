"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const icons = [
  { x: "8%", y: "18%", size: 110, delay: 0, duration: 20 },
  { x: "82%", y: "12%", size: 90, delay: 2, duration: 25 },
  { x: "72%", y: "65%", size: 100, delay: 1, duration: 22 },
  { x: "12%", y: "72%", size: 80, delay: 3, duration: 28 },
  { x: "48%", y: "82%", size: 95, delay: 0.5, duration: 24 },
  { x: "88%", y: "42%", size: 70, delay: 1.5, duration: 26 },
  { x: "35%", y: "8%", size: 75, delay: 2.5, duration: 23 },
  { x: "60%", y: "35%", size: 60, delay: 4, duration: 30 },
];

// Ambient glow spots scattered around
const glowSpots = [
  { x: "20%", y: "30%", size: 400, color: "62,135,195", delay: 0, duration: 8 },
  { x: "75%", y: "20%", size: 350, color: "62,135,195", delay: 2, duration: 10 },
  { x: "50%", y: "70%", size: 500, color: "65,184,213", delay: 1, duration: 12 },
  { x: "85%", y: "60%", size: 300, color: "62,135,195", delay: 3, duration: 9 },
  { x: "10%", y: "55%", size: 350, color: "65,184,213", delay: 1.5, duration: 11 },
];

export function FloatingIcons() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Ambient glow blobs */}
      {glowSpots.map((spot, i) => (
        <motion.div
          key={`glow-${i}`}
          className="absolute rounded-full"
          style={{
            left: spot.x,
            top: spot.y,
            width: spot.size,
            height: spot.size,
            background: `radial-gradient(circle, rgba(${spot.color}, 0.08) 0%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            opacity: [0.3, 0.7, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: spot.duration,
            repeat: Infinity,
            delay: spot.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Sui logo icons */}
      {icons.map((icon, i) => (
        <motion.div
          key={i}
          className="absolute opacity-[0.12]"
          style={{ left: icon.x, top: icon.y }}
          animate={{
            y: [0, -25, 0],
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
            className="drop-shadow-[0_0_20px_rgba(62,135,195,0.3)]"
          />
        </motion.div>
      ))}
    </div>
  );
}
