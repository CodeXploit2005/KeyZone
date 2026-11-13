"use client";

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { getNicheEditorData } from "@/app/niche-editor-data";
import { useI18n } from "@/i18n/client";
import { Button, ErrorNote, Loading } from "./ui";

const NicheForm = dynamic(() => import("@/app/[lang]/niches/niche-form").then(m => m.NicheForm), {
  ssr: false,
  loading: () => <Loading variant="form" />,
});

/** Ordinary links on desktop, immediate local sheets on mobile. */
export function NicheEditorLink({ nicheId, sheetTitle, ...props }: ComponentProps<typeof Link> & { nicheId?: string; sheetTitle: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  return <>
    <Link {...props} prefetch={false} ref={trigger} onClick={event => {
      props.onClick?.(event);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !window.matchMedia("(max-width: 1023px)").matches) return;
      event.preventDefault();
      setOpen(true);
    }} />
    {open && createPortal(<NicheSheet nicheId={nicheId} title={sheetTitle} onDismiss={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }} />, document.body)}
  </>;
}

function NicheSheet({ nicheId, title, onDismiss }: { nicheId?: string; title: string; onDismiss: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const openedPath = useRef(pathname);
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getNicheEditorData>> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Links inside the editor may navigate to guides; do not leave an overlay behind.
    if (pathname !== openedPath.current) onDismiss();
  }, [pathname, onDismiss]);

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getNicheEditorData(nicheId).then(value => { if (active) setData(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [nicheId, attempt]);

  function dismiss(destination?: string) {
    if (closing.current) return;
    closing.current = true;
    dialog.current?.setAttribute("data-closing", "true");
    timer.current = setTimeout(() => {
      dialog.current?.close();
      onDismiss();
      if (destination) {
        router.push(destination);
        router.refresh();
      }
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
  }

  return <dialog ref={dialog} className="niche-sheet" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); dismiss(); }} onClickCapture={e => {
    const anchor = (e.target as HTMLElement).closest("a[href]");
    const href = anchor?.getAttribute("href");
    if (href?.startsWith("/") && !href.startsWith("//") && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      dismiss(href);
    }
  }} onClick={e => { if (e.target === e.currentTarget) dismiss(); }}>
    <div className="niche-sheet-panel">
      <header className="niche-sheet-header">
        <span className="niche-sheet-handle" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">{t.niches.eyebrow}</p><h2 id={titleId} className="text-lg font-bold">{data?.niche?.name ?? title}</h2></div>
          <button type="button" className="niche-sheet-close" aria-label={t.nicheSheet.close} onClick={() => dismiss()}><X className="size-5" /></button>
        </div>
      </header>
      <div className="niche-sheet-content" aria-busy={!data && !error}>
        {error ? <div className="flex flex-col items-start gap-4 py-4"><ErrorNote>{t.nicheSheet.loadError}</ErrorNote><Button onClick={() => { setError(false); setAttempt(x => x + 1); }}>{t.errors.retry}</Button></div> : data ? <NicheForm {...data} onSaved={dismiss} /> : <Loading variant="form" />}
      </div>
    </div>
  </dialog>;
}
