"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Animate the existing main element; never remount editor drafts or media. */
export function NavigationMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const content = document.getElementById("studio-content");
    if (!content || preference.matches || !content.animate) return;
    const animation = content.animate(
      [{ opacity: 0.45, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 300, easing: "cubic-bezier(.2,.75,.25,1)" },
    );
    const cancel = () => animation.cancel();
    preference.addEventListener("change", cancel);
    return () => {
      animation.cancel();
      preference.removeEventListener("change", cancel);
    };
  }, [pathname]);
  return null;
}
