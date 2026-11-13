"use client";

import { useEffect, useState, type ReactNode, type FormEvent } from "react";

export function LicenseGate({ children, initial }: { children: ReactNode; initial?: { valid: boolean; expiresAt?: string; error?: string } }) {
  const [valid, setValid] = useState(initial?.valid === true);
  const [checking, setChecking] = useState(initial === undefined);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState(initial?.error || "");
  useEffect(() => {
    let alive = true;
    if (initial) { setValid(initial.valid === true); setError(initial.error || ""); setChecking(false); }
    let expiresAt = initial?.valid && initial.expiresAt ? Date.parse(initial.expiresAt) : 0;
    const check = async () => {
      try {
        const response = await fetch("/api/license", { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const result = await response.json();
        if (alive) { setValid(result.valid === true); setError(result.error || ""); setChecking(false); expiresAt = result.valid ? Date.parse(result.expiresAt) : 0; }
      } catch { if (alive) { setValid(false); setChecking(false); setError("Không thể kiểm tra key. Vui lòng kiểm tra kết nối Internet."); } }
    };
    // The proxy has already verified this request online. Avoid a second check on reload.
    if (!initial) void check();
    const timer = setInterval(check, 20000);
    const expiryTimer = setInterval(() => { if (expiresAt && Date.now() >= expiresAt) { setValid(false); setError("Key đã hết hạn."); } }, 1000);
    window.addEventListener("focus", check);
    return () => { alive = false; clearInterval(timer); clearInterval(expiryTimer); window.removeEventListener("focus", check); };
  }, [initial]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/license", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể kích hoạt key.");
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể kết nối."); setBusy(false); }
  }
  if (valid) return children;
  if (checking) return <div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#10111b", color: "#b5b2c9" }}>Đang mở studio…</div>;
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "radial-gradient(ellipse at top,#342052,#10111b 65%)", color: "#eee", position: "fixed", inset: 0, zIndex: 9999 }}>
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 440, border: "1px solid #3c3555", borderRadius: 24, padding: 36, background: "#1b1c2b", boxShadow: "0 20px 80px #0006" }}>
      <p style={{ color: "#ba93ff", fontWeight: 800, letterSpacing: 2 }}>KEYZONE VIDEO STUDIO</p>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "20px 0 12px" }}>Kích hoạt quyền sử dụng</h1>
      <p style={{ color: "#b5b2c9", lineHeight: 1.7, marginBottom: 24 }}>Nhập key được cấp để mở studio. Cần kết nối Internet để xác minh thời hạn sử dụng.</p>
      <label htmlFor="license-key">Key của bạn</label>
      <input id="license-key" value={key} onChange={e => setKey(e.target.value)} required maxLength={100} autoComplete="off" placeholder="KZ-XXXXXXXX-…" disabled={checking || busy} style={{ width: "100%", padding: 14, background: "#10111b", color: "white", border: "1px solid #514268", borderRadius: 10, margin: "10px 0 16px" }} />
      <p role="alert" style={{ color: "#ffb0b8", fontSize: 13, marginBottom: 16 }}>{error}</p>
      <button disabled={checking || busy} style={{ width: "100%", borderRadius: 10, padding: 14, fontWeight: 700, background: "#8843ec", color: "white", cursor: "pointer" }}>{checking ? "Đang kiểm tra key…" : busy ? "Đang kích hoạt…" : "Kích hoạt và mở studio"}</button>
      <p style={{ color: "#918caa", fontSize: 12, marginTop: 20 }}>Key hết hạn hoặc bị thu hồi? Liên hệ quản trị viên để được gia hạn.</p>
    </form>
  </div>;
}
