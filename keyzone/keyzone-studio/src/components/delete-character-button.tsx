"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCharacterFromLibrary } from "@/app/actions";
import { useI18n } from "@/i18n/client";
import { Button, ErrorNote } from "./ui";

export function DeleteCharacterButton({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const previousOverflow = useRef<string | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function restoreScroll() {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  }
  useEffect(() => restoreScroll, []);

  return <>
    <button type="button" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-subtle transition hover:bg-danger/10 hover:text-danger focus-visible:text-danger" aria-label={`${t.characterForm.delete}: ${name}`} title={t.characterForm.delete} onClick={() => {
      setError(null);
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.current?.showModal();
    }}><Trash2 className="size-3.5" /></button>
    <dialog ref={dialog} className="delete-video-dialog" aria-labelledby={headingId} aria-describedby={descriptionId} onClose={restoreScroll} onCancel={e => { if (pending) e.preventDefault(); }} onClick={e => { if (e.target === e.currentTarget && !pending) dialog.current?.close(); }}>
      <div className="p-5 sm:p-6">
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-danger/10 text-danger"><Trash2 className="size-5" /></span>
        <h2 id={headingId} className="text-lg font-bold">{t.characterForm.confirmDelete}</h2>
        <p className="mt-2 break-words text-sm font-medium text-foreground">{name}</p>
        <p id={descriptionId} className="mt-2 text-xs leading-relaxed text-muted">{t.characterForm.deleteDescription}</p>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button autoFocus variant="secondary" disabled={pending} onClick={() => dialog.current?.close()}>{t.project.cancelDelete}</Button>
          <Button variant="danger" disabled={pending} onClick={() => startTransition(async () => {
            setError(null);
            try {
              await deleteCharacterFromLibrary(id);
              dialog.current?.close();
              restoreScroll();
              router.refresh();
            } catch {
              setError(t.characterForm.deleteError);
            }
          })}>{pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}{pending ? t.project.deleting : t.characterForm.delete}</Button>
        </div>
      </div>
    </dialog>
  </>;
}

