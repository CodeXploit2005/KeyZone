"use client";

import React, { useEffect, useRef } from "react";

export function Ambient3DBackground() {
  const bgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onPointerMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 16;
      targetY = (e.clientY / window.innerHeight - 0.5) * 12;
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      el.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0) scale(1.03)`;
      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050513] select-none"
    >
      {/* Main Neon Silk Wave Background Image with Smooth GPU Parallax */}
      <div
        ref={bgRef}
        style={{
          backgroundImage: "url('./neon-wave-bg.jpg')",
          transform: "translate3d(0, 0, 0) scale(1.03)",
        }}
        className="absolute inset-0 bg-cover bg-center bg-no-repeat will-change-transform"
      />

      {/* Subtle Vignette & Depth Overlay for Text Readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(6, 6, 22, 0.08) 0%, rgba(4, 4, 15, 0.42) 100%)",
        }}
      />
    </div>
  );
}
