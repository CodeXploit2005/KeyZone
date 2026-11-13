"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { Button, Card, ErrorNote } from "./ui";
import { useI18n } from "@/i18n/client";
import { connectCall, MuseConnectDialog, type ConnectTarget } from "./muse-connect-dialog";
import { DeleteMuseAccountDialog } from "./delete-muse-account-dialog";

type Account = { id: string; label: string; enabled: boolean; ok: boolean | null; workspace_status: string; workspace_checked_at?: number };

export function AccountsPanel() {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedNow, setCheckedNow] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [target, setTarget] = useState<ConnectTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const active = target !== null || deleteTarget !== null || checking !== null;
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/muse-connect", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAccounts(data.accounts);
      setCheckedNow(Date.now() / 1000);
      setError("");
    } catch { setError("Không tải được tài khoản. Kiểm tra kết nối rồi tải lại trang."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let stopped = false;
    const timer = setTimeout(() => {
      void load();
      void connectCall("resume").then(result => {
        if (!stopped && result.active) setTarget({ resume: true });
      }).catch(() => {});
    }, 0);
    return () => { stopped = true; clearTimeout(timer); };
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && !active) void load(); }, 30_000);
    return () => clearInterval(timer);
  }, [load, active]);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 4_000);
    return () => clearTimeout(timer);
  }, [success]);
  async function check(account: Account) {
    setChecking(account.id); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/muse-connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", account_id: account.id }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || (vi ? "Chưa kiểm tra được workspace." : "Could not verify workspace."));
      if (!result.ok) throw new Error(result.message || (vi ? "Workspace chưa sẵn sàng. Hãy thử lại hoặc kết nối lại tài khoản." : "Workspace is not ready. Retry or reconnect the account."));
      setSuccess(vi ? "Workspace đã sẵn sàng." : "Workspace is ready.");
      void load();
      window.dispatchEvent(new Event("muse-accounts-changed"));
    } catch (error) { setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : (vi ? "Kiểm tra quá thời gian. Phiên đăng nhập vẫn được giữ; hãy thử lại." : "Check timed out. Your session is kept; please retry.")); }
    finally { setChecking(null); }
  }
  function start(account?: Account) {
    setError(""); setSuccess("");
    setTarget(account ? { id: account.id, label: account.label } : {});
  }
  return <>
    <Card className="mb-6 flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-gold"><ShieldCheck className="size-5" /></span>
        <div className="min-w-0"><h2 className="font-semibold">{vi ? "Kết nối tài khoản" : "Connect an account"}</h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">{vi ? "Đăng nhập Muse để tạo video." : "Sign in to Muse to create videos."}</p></div>
      </div>
      <Button disabled={active} onClick={() => void start()} className="min-h-11">
        <Plus />{vi ? "Kết nối Muse" : "Connect Muse"}
      </Button>
    </Card>
    <div className="mb-3 flex min-w-0 items-center justify-between gap-3"><h2 className="text-sm font-semibold">{vi ? "Tài khoản đã kết nối" : "Connected accounts"}<span className="ml-2 text-xs font-normal text-subtle">{loading ? "…" : accounts.length}</span></h2><span className="shrink-0 rounded-full bg-surface-soft px-2 py-1 text-[10px] text-subtle">{vi ? "Bản thử nghiệm" : "Preview"}</span></div>
    {success && <div role="status" className="mb-5 flex items-center gap-2 rounded-xl bg-success/10 py-2 pl-4 pr-2 text-sm text-success"><CheckCircle2 className="size-4 shrink-0" /><span className="min-w-0 flex-1">{success}</span><Button variant="ghost" size="icon" className="min-h-11 min-w-11 !text-success" aria-label={vi ? "Đóng thông báo" : "Dismiss notification"} onClick={() => setSuccess("")}><X /></Button></div>}
    {error && !active && <div role="alert" className="mb-5"><ErrorNote>{error}</ErrorNote></div>}
    {loading ? <p className="text-sm text-muted">{vi ? "Đang tải tài khoản…" : "Loading accounts…"}</p> : accounts.length === 0 ?
      <Card className="p-8 text-center text-sm text-muted">{vi ? "Chưa có tài khoản. Kết nối Muse để bắt đầu." : "No accounts yet. Connect Muse to get started."}</Card> :
      <div className="grid gap-3 md:grid-cols-2">{accounts.map(account => {
        const disconnected = account.workspace_status === "disconnected";
        const ready = account.ok !== false && account.workspace_status === "ready" && !!account.workspace_checked_at && checkedNow - account.workspace_checked_at < 300;
        return <Card key={account.id} className="flex min-w-0 flex-col gap-4 p-4">
        <div className="min-w-0 w-full"><p className="truncate text-sm font-semibold" title={account.label}>{account.label}</p>
          <p role="status" className="mt-1 flex items-center gap-1.5 text-xs leading-relaxed text-muted"><span className={`size-1.5 shrink-0 rounded-full ${!account.enabled ? "bg-subtle" : disconnected || account.ok === false ? "bg-danger" : ready ? "bg-success" : "bg-warning"}`} />
            {!account.enabled ? (vi ? "Đã tắt" : "Disabled") : disconnected ? (vi ? "Muse đã ngắt kết nối" : "Muse disconnected") : account.ok === false ? (vi ? "Phiên đăng nhập không hợp lệ" : "Sign-in no longer valid") : ready ? (vi ? "Workspace sẵn sàng · vừa kiểm tra" : "Workspace ready · recently checked") : (vi ? "Chưa xác minh workspace · cần kiểm tra" : "Workspace unverified · check required")}</p>
          {disconnected && <p className="mt-2 text-xs leading-relaxed text-muted">{vi ? "Mở muse.ai và gửi ticket để kết nối lại, hoặc thay tài khoản." : "Open muse.ai and submit a ticket to reconnect, or replace this account."}</p>}
          {!!account.workspace_checked_at && <p className="mt-2 text-xs leading-relaxed text-subtle">{vi ? "Kiểm tra workspace: " : "Workspace checked: "}{new Date(account.workspace_checked_at * 1000).toLocaleString(vi ? "vi-VN" : "en-GB")}</p>}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-2 border-t border-border pt-3">
          <Button variant="secondary" size="sm" className="min-h-11 min-w-0 !gap-1.5 !px-2" disabled={active || !account.enabled} onClick={() => void check(account)}><ShieldCheck className={`shrink-0 ${checking === account.id ? "animate-pulse" : ""}`} /><span className="truncate">{checking === account.id ? (vi ? "Đang kiểm tra…" : "Checking…") : (vi ? "Kiểm tra" : "Check")}</span></Button>
          <Button variant="secondary" size="sm" className="min-h-11 min-w-0 !gap-1.5 !px-2" disabled={active} aria-label={`${vi ? "Thay tài khoản" : "Replace account"}: ${account.label}`} onClick={() => void start(account)}><RefreshCw className="shrink-0" /><span className="truncate sm:hidden">{vi ? "Thay" : "Replace"}</span><span className="hidden truncate sm:inline">{vi ? "Thay tài khoản" : "Replace account"}</span></Button>
          <Button variant="ghost" size="icon" disabled={active} className="min-h-11 min-w-11 !text-subtle hover:!bg-danger/10 hover:!text-danger" title={vi ? "Xóa kết nối" : "Remove connection"} aria-label={`${vi ? "Xóa kết nối" : "Remove connection"}: ${account.label}`} onClick={() => { setError(""); setDeleteTarget(account); }}><Trash2 /></Button>
        </div>
      </Card>; })}</div>}
    <details className="mt-6 text-xs text-muted"><summary>{vi ? "Cài đặt nâng cao" : "Advanced settings"}</summary>
      <p className="mt-3 leading-relaxed">{vi ? "Bản thử nghiệm trên máy chủ hiện tại. Phiên đăng nhập tự đóng sau 15 phút. Chỉ lưu phiên khi bạn bấm Hoàn tất và Muse xác minh thành công." : "Local-server prototype. Sign-in closes after 15 minutes. A session is saved only after you finish and Muse verifies it."}</p>
      <a href="http://localhost:18610/admin" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-gold">{vi ? "Mở quản trị Muse2API trên máy chủ này" : "Open Muse2API admin on this computer"}<ExternalLink className="size-3" /></a>
    </details>

    {target && <MuseConnectDialog target={target} onClose={() => setTarget(null)} onConnected={(name) => {
      setTarget(null);
      setSuccess(vi ? `Đã kết nối ${name}.` : `Connected ${name}.`);
      void load();
      window.dispatchEvent(new Event("muse-accounts-changed"));
    }} />}
    {deleteTarget && <DeleteMuseAccountDialog account={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => {
      setAccounts(rows => rows.filter(row => row.id !== deleteTarget.id));
      setSuccess(vi ? `Đã gỡ kết nối ${deleteTarget.label}.` : `Removed ${deleteTarget.label}.`);
      setDeleteTarget(null);
      window.dispatchEvent(new Event("muse-accounts-changed"));
    }} />}
  </>;
}
