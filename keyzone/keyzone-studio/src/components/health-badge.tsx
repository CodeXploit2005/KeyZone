"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n/client";

type Health = { ok: boolean; muse?: { accounts: number; status?: string }; error?: string };

export function HealthBadge() {
  const { t, locale } = useI18n();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/health")
        .then((r) => r.json() as Promise<Health>)
        .then((h) => alive && setHealth(h))
        .catch(() => alive && setHealth({ ok: false, error: "unreachable" }));
    load();
    window.addEventListener("muse-accounts-changed", load);
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("muse-accounts-changed", load);
    };
  }, []);

  const unverified = health?.muse?.status === "unverified";
  const tone = !health ? "bg-subtle" : unverified ? "bg-warning" : health.ok ? "bg-success" : "bg-danger";
  const label = !health ? t.health.checking : unverified ? (locale === "vi" ? "Cần kiểm tra workspace" : "Check workspace") : health.ok ? t.health.connected : t.health.disconnected;
  const detail = health?.ok ? t.health.accounts(health.muse?.accounts ?? 0) : health?.error;

  return (
    <div className="flex flex-col gap-2">
    <div
      className="flex items-center gap-2.5 rounded-lg bg-surface-soft px-2.5 py-2"
      title={health?.error}
    >
      <span className="relative flex size-2">
        <span className={`relative inline-flex size-2 rounded-full ${tone}`} />
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] font-medium">{label}</span>
        {detail && <span className="truncate text-[11px] text-subtle">{detail}</span>}
      </div>
    </div>
    <Link
      href="/accounts"
      className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-soft px-3 py-2.5 text-xs font-medium transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-gold"
    >
      <Users className="size-4 shrink-0" />
      <span className="flex-1">{t.health.manageAccounts}</span>
      <ChevronRight className="size-3.5 shrink-0 text-muted" />
    </Link>
    </div>
  );
}
