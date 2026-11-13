import { ArrowLeftRight, ChevronDown, Settings2 } from "lucide-react";
import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { getActiveNiche } from "@/lib/active-niche";
import { NicheIcon } from "./niche-icon";
import { NicheEditorLink } from "./niche-editor-link";

export async function NicheSwitcher({ compact = false, mobile = false }: { compact?: boolean; mobile?: boolean }) {
  const [niche, t] = await Promise.all([getActiveNiche(), getDictionary()]);

  if (!niche) {
    return (
      <Link
        href="/niches"
        className="gold-ring flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gold-light transition hover:bg-gold/5"
      >
        <ArrowLeftRight className="size-4" />
        {t.switcher.pickToStart}
      </Link>
    );
  }

  if (mobile) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-soft/70 px-3 py-2">
        <Link href="/niches" title={t.switcher.switch} className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted"><NicheIcon value={niche.icon} className="size-4" /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-[9px] leading-tight text-subtle">{t.switcher.active}</span><span className="truncate text-xs font-semibold">{niche.name}</span></span>
          <ChevronDown className="size-3.5 shrink-0 text-subtle" />
        </Link>
        <NicheEditorLink href={`/niches/${niche.id}`} nicheId={niche.id} sheetTitle={niche.name} aria-label={t.switcher.configure} className="flex size-10 shrink-0 items-center justify-center rounded-lg border-l border-border text-muted hover:bg-surface"><Settings2 className="size-4" /></NicheEditorLink>
      </div>
    );
  }

  if (compact) {
    return (
      <Link
        href="/niches"
        className="flex items-center gap-2 rounded-xl frost px-2.5 py-1.5 text-xs"
        title={t.switcher.switch}
      >
        <NicheIcon value={niche.icon} className="size-4 shrink-0 text-muted" />
        <span className="max-w-16 truncate font-medium sm:max-w-28">{niche.name}</span>
        <ArrowLeftRight className="size-3.5 text-gold" />
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="px-1 text-[10px] font-semibold tracking-[0.1em] text-subtle uppercase">{t.switcher.active}</div>
      <Link href="/niches" className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-soft/70 p-2.5 transition hover:border-violet-200 hover:bg-accent-soft/60" title={t.switcher.switch}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted">
          <NicheIcon value={niche.icon} className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{niche.name}</div>
          <div className="mt-0.5 text-[10px] text-subtle">{niche.defaultAspectRatio} · {t.common.scenes(niche.sceneCount)}</div>
        </div>
        <ChevronDown className="ml-auto size-3.5 shrink-0 text-subtle" />
      </Link>
      <div className="flex items-center justify-between gap-1 px-1">
        <Link
          href="/niches"
          className="flex items-center gap-1.5 py-1 text-[11px] text-muted transition hover:text-gold"
        >
          <ArrowLeftRight className="size-3.5" /> {t.switcher.switch}
        </Link>
        <Link
          href={`/niches/${niche.id}`}
          title={t.switcher.configure}
          className="flex items-center gap-1 rounded-md p-1 text-subtle transition hover:bg-accent-soft hover:text-gold"
        >
          <Settings2 className="size-3.5" /><span className="sr-only">{t.switcher.configure}</span>
        </Link>
      </div>
    </div>
  );
}
