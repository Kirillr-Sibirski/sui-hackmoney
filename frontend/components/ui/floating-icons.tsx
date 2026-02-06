"use client";

import { motion } from "framer-motion";
import Image from "next/image";

// Icons at different "depth layers" — z controls scale, blur, opacity, speed
const icons = [
  // Far background (small, blurry, slow)
  { x: "15%", y: "20%", size: 50, delay: 0, duration: 30, z: 0.1 },
  { x: "70%", y: "75%", size: 45, delay: 3, duration: 35, z: 0.15 },
  { x: "85%", y: "15%", size: 40, delay: 5, duration: 32, z: 0.1 },
  // Mid background
  { x: "35%", y: "10%", size: 65, delay: 1, duration: 24, z: 0.35 },
  { x: "88%", y: "45%", size: 60, delay: 2.5, duration: 26, z: 0.3 },
  { x: "8%", y: "65%", size: 70, delay: 4, duration: 22, z: 0.4 },
  // Mid foreground (larger, clearer)
  { x: "60%", y: "30%", size: 85, delay: 0.5, duration: 20, z: 0.6 },
  { x: "25%", y: "80%", size: 80, delay: 2, duration: 22, z: 0.55 },
  // Near foreground (biggest, sharpest, fastest float)
  { x: "78%", y: "62%", size: 110, delay: 1, duration: 18, z: 0.85 },
  { x: "10%", y: "25%", size: 100, delay: 0, duration: 16, z: 0.9 },
  { x: "50%", y: "85%", size: 95, delay: 3, duration: 19, z: 0.75 },
];

// Layered glow orbs for volumetric lighting
const glowOrbs = [
  // Large atmospheric washes
  { x: "30%", y: "20%", size: 800, color: "62,135,195", opacity: 0.04, blur: 80, delay: 0, duration: 12 },
  { x: "70%", y: "70%", size: 700, color: "65,184,213", opacity: 0.035, blur: 70, delay: 2, duration: 15 },
  { x: "50%", y: "40%", size: 900, color: "62,135,195", opacity: 0.03, blur: 100, delay: 1, duration: 18 },
  // Tighter accent lights
  { x: "20%", y: "50%", size: 350, color: "100,170,230", opacity: 0.06, blur: 30, delay: 3, duration: 10 },
  { x: "80%", y: "25%", size: 300, color: "62,135,195", opacity: 0.07, blur: 25, delay: 1.5, duration: 9 },
  { x: "55%", y: "80%", size: 400, color: "65,184,213", opacity: 0.05, blur: 35, delay: 4, duration: 11 },
  // Small bright points (like distant light sources)
  { x: "15%", y: "35%", size: 150, color: "130,190,240", opacity: 0.08, blur: 15, delay: 0.5, duration: 8 },
  { x: "85%", y: "55%", size: 120, color: "130,190,240", opacity: 0.07, blur: 12, delay: 2.5, duration: 7 },
];

export function FloatingIcons() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" style={{ perspective: "1200px" }}>
      {/* Atmospheric gradient layers for 3D depth */}

      {/* Top light source — like light coming from above */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(62,135,195,0.1) 0%, transparent 70%)",
        }}
      />

      {/* Secondary side light */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 60% at 95% 30%, rgba(65,184,213,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Bottom shadow — grounds everything */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 40%)",
        }}
      />

      {/* Vignette for cinematic depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.12) 100%)",
        }}
      />

      {/* Glow orbs — volumetric light effect */}
      {glowOrbs.map((orb, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, rgba(${orb.color}, ${orb.opacity}) 0%, rgba(${orb.color}, 0) 70%)`,
            transform: "translate(-50%, -50%)",
            filter: `blur(${orb.blur}px)`,
          }}
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            delay: orb.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Sui logo icons with depth-based rendering */}
      {icons.map((icon, i) => {
        const blurAmount = Math.max(0, (1 - icon.z) * 3);
        const iconOpacity = 0.04 + icon.z * 0.1;
        const glowIntensity = 0.1 + icon.z * 0.25;
        const glowSize = 10 + icon.z * 20;
        const floatRange = 10 + icon.z * 20;
        const scale = 0.7 + icon.z * 0.3;

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: icon.x,
              top: icon.y,
              opacity: iconOpacity,
              filter: `blur(${blurAmount}px) drop-shadow(0 0 ${glowSize}px rgba(62,135,195,${glowIntensity}))`,
              transformStyle: "preserve-3d",
              transform: `scale(${scale})`,
            }}
            animate={{
              y: [0, -floatRange, 0],
              rotateY: [0, 8, -8, 0],
              rotateX: [0, -3, 3, 0],
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
        );
      })}

      {/* Subtle grid — adds spatial reference */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(62,135,195,0.4) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(62,135,195,0.4) 1px, transparent 1px)",
          backgroundSize: "100px 100px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 80%)",
        }}
      />

      {/* Light streak / ray from top */}
      <motion.div
        className="absolute"
        style={{
          left: "45%",
          top: "-10%",
          width: "200px",
          height: "120%",
          background:
            "linear-gradient(180deg, rgba(62,135,195,0.04) 0%, transparent 60%)",
          transform: "rotate(15deg)",
          filter: "blur(40px)",
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          x: [-20, 20, -20],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Second light ray */}
      <motion.div
        className="absolute"
        style={{
          left: "65%",
          top: "-10%",
          width: "150px",
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(65,184,213,0.03) 0%, transparent 50%)",
          transform: "rotate(-10deg)",
          filter: "blur(50px)",
        }}
        animate={{
          opacity: [0.2, 0.5, 0.2],
          x: [15, -15, 15],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          delay: 3,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
