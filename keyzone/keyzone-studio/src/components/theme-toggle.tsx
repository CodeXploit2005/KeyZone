"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";

const storageKey = "keyzone-theme";

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  function sync() {
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* Session-only preference. */ }
    document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light";
    onChange();
  }
  window.addEventListener("keyzone-theme-change", onChange);
  window.addEventListener("storage", sync);
  media.addEventListener("change", sync);
  return () => {
    window.removeEventListener("keyzone-theme-change", onChange);
    window.removeEventListener("storage", sync);
    media.removeEventListener("change", sync);
  };
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n();
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  const label = locale === "vi" ? dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối" : dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className={`theme-toggle ${compact ? "theme-toggle--compact" : ""}`} aria-label={label} title={label} onClick={() => {
      const next = dark ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(storageKey, next); } catch { /* Keep the choice for this session. */ }
      window.dispatchEvent(new Event("keyzone-theme-change"));
    }}>
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {!compact && <span>{locale === "vi" ? dark ? "Chế độ tối" : "Chế độ sáng" : dark ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
