"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, ChevronLeft, LoaderCircle, ShieldCheck, WifiOff, X } from "lucide-react";
import { Button, ErrorNote, inputClass } from "./ui";
import { useI18n } from "@/i18n/client";

export type ConnectTarget = { id?: string; label?: string; resume?: boolean };
type Field = { index: number; fingerprint: string; type: string; label: string; placeholder: string; autocomplete: string };
type Frame = { image: string; width: number; height: number; fields: Field[]; otp?: { index: number; fingerprint: string; length: number } | null; can_finish: boolean; origin: string; challenge?: boolean; message?: string; waiting?: boolean };

function stepKey(frame: Frame) {
  return JSON.stringify([frame.origin, frame.fields.map(field => field.fingerprint), frame.otp?.fingerprint, frame.can_finish]);
}

export class ConnectError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}
export async function connectCall(action: string, extra = {}) {
  let response: Response;
  try {
    response = await fetch("/api/muse-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }), signal: AbortSignal.timeout(50_000) });
  } catch { throw new ConnectError("Mất kết nối với Studio. Kiểm tra mạng rồi bấm Thử lại."); }
  let data;
  try { data = await response.json(); }
  catch { throw new ConnectError("Dịch vụ chưa phản hồi. Vui lòng thử lại.", response.status); }
  if (!response.ok) throw new ConnectError(data.error || "Thao tác chưa thành công.", response.status);
  return data;
}

export function MuseConnectDialog({ target, onClose, onConnected }: { target: ConnectTarget; onClose: () => void; onConnected: (label: string) => void }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const dialog = useRef<HTMLDialogElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [expired, setExpired] = useState(false);
  const [label, setLabel] = useState(target.label || "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [showRemote, setShowRemote] = useState(false);
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const submitting = useRef(false);
  const pollNow = useRef<() => Promise<void>>(async () => {});
  const generation = useRef(0);
  const sessionKey = useRef<string | null>(null);
  const sessionExpired = useRef(false);
  const stepError = useRef<string | null>(null);
  const connectionFailures = useRef(0);
  const otp = frame?.otp;
  const ready = !!frame?.can_finish;
  const stage = ready ? 3 : otp ? 2 : 1;
  const signature = frame ? `${frame.origin}:${frame.fields.map(f => f.fingerprint).join('|')}:${otp?.fingerprint || ''}` : "";

  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const element = dialog.current;
      if (!element) return;
      element.style.setProperty("--muse-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      element.style.setProperty("--muse-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty("--muse-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      element.style.setProperty("--muse-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    alive.current = true;
    sessionExpired.current = false;
    connectionFailures.current = 0;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const update = async () => {
      if (stopped || submitting.current || sessionExpired.current || document.hidden || !navigator.onLine) return;
      const version = generation.current;
      try {
        const next: Frame = await connectCall("state");
        if (!stopped && version === generation.current) {
          connectionFailures.current = 0;
          setFrame(next); setNetworkError("");
          if (stepError.current !== null && (next.can_finish || stepKey(next) !== stepError.current)) {
            stepError.current = null; setError(""); setNotice("");
          }
        }
      } catch (e) {
        if (!stopped) {
          if (!(e as ConnectError).status || (e as ConnectError).status >= 500) connectionFailures.current = Math.min(connectionFailures.current + 1, 5);
          setNetworkError((e as Error).message);
          if ((e as ConnectError).status === 410) { sessionExpired.current = true; setExpired(true); }
        }
      }
    };
    pollNow.current = update;
    const poll = async () => { await update(); if (!stopped) timer = setTimeout(poll, Math.min(2000 * 2 ** connectionFailures.current, 30_000)); };
    const startTimer = setTimeout(() => {
      void (async () => {
        try {
          if (!target.resume) {
            await connectCall("start", { replace_id: target.id });
          }
          if (stopped) { void connectCall("cancel").catch(() => {}); return; }
          sessionKey.current = "active";
          await poll();
        } catch (e) { if (!stopped) { setError((e as Error).message); setExpired(true); } }
        finally { if (!stopped) setOpening(false); }
      })();
    }, 0);
    return () => {
      stopped = true; alive.current = false;
      clearTimeout(startTimer); clearTimeout(timer);
      document.body.style.overflow = previous;
      if (sessionKey.current) void connectCall("cancel").catch(() => {});
    };
  }, [target]);

  async function act(input: object) { return connectCall("input", { input }); }
  async function submit() {
    if (!frame || submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setNotice("");
    generation.current++; stepError.current = null;
    try {
      if (otp) {
        await act({ kind: "fill", index: otp.index, fingerprint: otp.fingerprint, value: code });
      } else {
        for (const field of frame.fields) {
          const value = values[field.fingerprint];
          if (value !== undefined) await act({ kind: "fill", index: field.index, fingerprint: field.fingerprint, value });
        }
      }
      await act({ kind: "advance", fingerprint: otp?.fingerprint || frame.fields[0]?.fingerprint });
      setCode(""); setValues({});
      setNotice(vi ? "Đã gửi. Đang chờ Muse phản hồi…" : "Sent. Waiting for Muse…");
    } catch (e) { stepError.current = stepKey(frame); setError((e as Error).message); }
    finally {
      submitting.current = false;
      if (alive.current) { setBusy(false); await pollNow.current(); }
    }
  }
  async function secondary(kind: string) {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); generation.current++;
    try { await act({ kind }); setCode(""); setValues({}); setNotice(vi ? "Yêu cầu đã gửi tới Muse." : "Request sent to Muse."); }
    catch (e) { stepError.current = frame ? stepKey(frame) : null; setError((e as Error).message); }
    finally { submitting.current = false; if (alive.current) { setBusy(false); await pollNow.current(); } }
  }
  async function finish() {
    stepError.current = null;
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await connectCall("complete", { label });
      sessionKey.current = null;
      onConnected(result.account.label);
    } catch (e) { setError((e as Error).message); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  }
  async function restart() {
    connectionFailures.current = 0;
    stepError.current = null;
    sessionExpired.current = false;
    submitting.current = true; generation.current++;
    setOpening(true); setError(""); setNetworkError(""); setExpired(false); setFrame(null); setCode(""); setValues({});
    try { await connectCall("start", { replace_id: target.id }); sessionKey.current = "active"; }
    catch (e) { setError((e as Error).message); setExpired(true); }
    finally { submitting.current = false; setOpening(false); await pollNow.current(); }
  }
  function fieldLabel(field: Field) {
    if (field.type === "password") return vi ? "Mật khẩu" : "Password";
    if (/email|mobile|phone|username/i.test(field.placeholder + field.autocomplete)) return vi ? "Email hoặc số điện thoại" : "Email or mobile number";
    return field.label;
  }

  return createPortal(<dialog ref={dialog} className="muse-connect-dialog" aria-labelledby="muse-connect-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div><h2 id="muse-connect-title" className="font-semibold">{target.id ? (vi ? "Thay tài khoản Muse" : "Replace Muse account") : (vi ? "Kết nối Muse" : "Connect Muse")}</h2>
        <p className="mt-1 text-xs text-muted">{vi ? "Đăng nhập an toàn qua Muse" : "Sign in through Muse"}</p></div>
      <Button variant="ghost" size="icon" disabled={busy} aria-label={vi ? "Đóng" : "Close"} onClick={onClose}><X /></Button>
    </header>
    <div className="muse-connect-body p-5 sm:p-6">
      <ol aria-label={vi ? "Các bước kết nối" : "Connection steps"} className="muse-connect-steps">
        {[vi ? "Tài khoản" : "Account", vi ? "Xác minh" : "Verify", vi ? "Hoàn tất" : "Finish"].map((name, i) => <li key={name} aria-current={stage === i + 1 ? "step" : undefined} className={`flex min-w-0 flex-col items-center justify-start gap-2 text-center text-xs ${stage >= i + 1 ? 'text-gold' : 'text-subtle'}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${stage >= i + 1 ? 'bg-accent-soft' : 'bg-surface-soft'}`}>{stage > i + 1 ? <Check className="size-3.5" /> : i + 1}</span><span>{name}</span></li>)}
      </ol>
      {networkError && <div role="alert" className="mb-5 rounded-xl border border-border bg-surface-soft p-4"><p className="flex items-start gap-2 text-sm text-muted"><WifiOff className="mt-0.5 size-4 shrink-0" />{networkError}</p><Button variant="secondary" size="sm" className="mt-3" disabled={opening || busy} onClick={() => void (expired ? restart() : pollNow.current())}>{expired ? (vi ? "Kết nối lại" : "Reconnect") : (vi ? "Thử lại" : "Retry")}</Button></div>}
      {error && <div role="alert" className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
      {opening ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted"><LoaderCircle className="size-5 animate-spin" />{vi ? "Đang mở kết nối…" : "Opening connection…"}</div> : expired ? <Button className="w-full" onClick={() => void restart()}>{vi ? "Bắt đầu lại" : "Start again"}</Button> : ready ?
        <div><span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success"><ShieldCheck className="size-7" /></span><h3 className="text-xl font-semibold">{vi ? "Đã đăng nhập Muse" : "Signed in to Muse"}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{vi ? "Đặt tên để dễ nhận biết, rồi hoàn tất kết nối." : "Give this connection a name, then finish."}</p><label className="mt-5 block text-sm">{vi ? "Tên tài khoản (tùy chọn)" : "Account label (optional)"}<input value={label} maxLength={100} onChange={e => setLabel(e.target.value)} className={`${inputClass} mt-2 !text-base`} placeholder={vi ? "Ví dụ: Tài khoản chính" : "e.g. Main account"} /></label><Button className="mt-5 min-h-12 w-full" disabled={busy} onClick={() => void finish()}>{busy && <LoaderCircle className="animate-spin" />}{vi ? "Hoàn tất kết nối" : "Finish connection"}</Button></div> : frame && (otp || frame.fields.length > 0) ?
        <form className="muse-connect-form" key={signature} onSubmit={e => { e.preventDefault(); void submit(); }}>
          <h3 className="text-xl font-semibold">{otp ? (vi ? "Nhập mã xác minh" : "Enter verification code") : (vi ? "Đăng nhập tài khoản" : "Sign in to your account")}</h3>
          <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">{otp ? (vi ? "Nhập mã Muse đã gửi tới email hoặc số điện thoại của bạn." : "Enter the code Muse sent to your email or phone.") : (vi ? "Dùng thông tin tài khoản Muse của bạn để tiếp tục." : "Use your Muse account details to continue.")}</p>
          {otp ? <label className="block text-sm font-medium">{vi ? `Mã ${otp.length} chữ số` : `${otp.length}-digit code`}<input name="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern={`[0-9]{${otp.length}}`} maxLength={otp.length} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, otp.length))} disabled={busy} className={`${inputClass} mt-2 min-h-14 text-center !text-2xl tracking-[0.3em]`} placeholder={"0".repeat(otp.length)} /></label> : frame.fields.map(field => <label key={field.fingerprint} className="mb-4 block text-sm font-medium">{fieldLabel(field)}<input type={field.type === 'number' ? 'text' : field.type} inputMode={field.type === 'number' || field.type === 'tel' ? 'tel' : undefined} required disabled={busy} autoComplete={field.type === 'password' ? 'current-password' : 'username'} value={values[field.fingerprint] || ''} onChange={e => setValues(prev => ({...prev, [field.fingerprint]: e.target.value}))} className={`${inputClass} mt-2 min-h-12 !text-base`} /></label>)}
          <Button type="submit" className="mt-5 min-h-12 w-full" disabled={busy || !!networkError || (otp ? code.length !== otp.length : frame.fields.some(f => !values[f.fingerprint]))}>{busy && <LoaderCircle className="animate-spin" />}{otp ? (vi ? "Xác nhận mã" : "Verify code") : (vi ? "Tiếp tục" : "Continue")}</Button>
          {otp && <div className="mt-3 flex justify-between gap-2"><Button variant="ghost" size="sm" disabled={busy} onClick={() => void secondary('back')}><ChevronLeft />{vi ? "Đổi email / SĐT" : "Change email / phone"}</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void secondary('resend')}>{vi ? "Gửi lại mã" : "Resend code"}</Button></div>}
        </form> : <div className="rounded-xl bg-surface-soft p-4 text-sm leading-relaxed text-muted">{frame?.challenge ? (vi ? "Muse yêu cầu xác minh thêm. Mở màn hình Muse bên dưới để hoàn tất." : "Muse needs another verification step. Open the Muse screen below.") : (vi ? "Đang chờ phản hồi từ Muse. Nếu có yêu cầu bổ sung, mở màn hình Muse bên dưới." : "Waiting for Muse. Open the Muse screen below for additional steps.")}</div>}
      {frame?.message && <p role="alert" className="mt-4 text-sm text-danger">{frame.message}</p>}
      {notice && <p role="status" className="mt-4 text-xs text-muted">{notice}</p>}
      {frame && !ready && (frame.challenge || error || showRemote || (!otp && frame.fields.length === 0)) && <details className="mt-6 border-t border-border pt-4" open={showRemote} onToggle={e => setShowRemote(e.currentTarget.open)}>
        <summary className="text-xs font-medium text-muted">{vi ? "Xem màn hình Muse khi cần hỗ trợ" : "Open Muse screen for additional steps"}</summary>
        {showRemote && <><p className="my-3 text-[11px] text-subtle">{frame.origin}</p><div className="muse-remote-screen" style={{ aspectRatio: `${frame.width}/${frame.height}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img draggable={false} src={`data:image/jpeg;base64,${frame.image}`} alt={vi ? "Màn hình Muse" : "Muse screen"} className="block size-full" onClick={async e => {
            const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX-r.left)*frame.width/r.width; const y = (e.clientY-r.top)*frame.height/r.height;
            try { await act({ kind:'click', x, y }); await pollNow.current(); } catch(err) { setError((err as Error).message); }
          }} />
        </div><div className="mt-2 flex justify-center gap-3"><Button variant="ghost" size="sm" aria-label="Scroll up" onClick={() => void act({kind:'scroll',delta:-450}).then(()=>pollNow.current()).catch(e=>setError(e.message))}><ArrowUp /></Button><Button variant="ghost" size="sm" aria-label="Scroll down" onClick={() => void act({kind:'scroll',delta:450}).then(()=>pollNow.current()).catch(e=>setError(e.message))}><ArrowDown /></Button></div></>}
      </details>}
    </div>
  </dialog>, document.body);
}
