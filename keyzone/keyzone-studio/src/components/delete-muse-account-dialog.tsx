"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button, ErrorNote } from "./ui";
import { connectCall } from "./muse-connect-dialog";

export function DeleteMuseAccountDialog({ account, onClose, onDeleted }: {
  account: { id: string; label: string }; onClose: () => void; onDeleted: () => void;
}) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const description = useId();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previous; };
  }, []);
  async function remove() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await connectCall("delete", { account_id: account.id });
      onDeleted();
    } catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return createPortal(<dialog ref={dialog} className="delete-video-dialog" aria-labelledby={heading} aria-describedby={description}
    onCancel={e => { e.preventDefault(); if (!pending.current) onClose(); }}
    onClick={e => { if (e.target === e.currentTarget && !pending.current) onClose(); }}>
    <div className="p-5 sm:p-6">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-danger/10 text-danger"><Trash2 className="size-5" /></span>
      <h2 id={heading} className="text-lg font-semibold">{vi ? "Xóa kết nối tài khoản?" : "Remove account connection?"}</h2>
      <p className="mt-2 break-words text-sm font-medium">{account.label}</p>
      <p id={description} className="mt-2 text-sm leading-relaxed text-muted">{vi ? "Tài khoản sẽ được gỡ khỏi Studio. Các dự án và video đã tạo vẫn được giữ nguyên. Bạn có thể kết nối lại tài khoản sau." : "This removes the account from Studio. Existing projects and videos are kept. You can reconnect the account later."}</p>
      {error && <div role="alert" className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button autoFocus variant="secondary" disabled={busy} onClick={onClose}>{vi ? "Hủy" : "Cancel"}</Button>
        <Button variant="danger" disabled={busy} aria-busy={busy} onClick={() => void remove()}>{busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}{busy ? (vi ? "Đang xóa…" : "Removing…") : (vi ? "Xóa kết nối" : "Remove")}</Button>
      </div>
    </div>
  </dialog>, document.body);
}
