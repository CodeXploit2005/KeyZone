import { headers } from "next/headers";
import { LicenseGate } from "./license-gate";
import type { ReactNode } from "react";

export async function VerifiedLicenseGate({ children }: { children: ReactNode }) {
  const value = (await headers()).get("x-keyzone-license-state");
  let initial: { valid: boolean; expiresAt?: string; error?: string } | undefined;
  try { if (value) initial = JSON.parse(decodeURIComponent(value)); } catch { /* fail closed */ }
  return <LicenseGate initial={initial}>{children}</LicenseGate>;
}

export function StudioLoading() {
  return <div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#10111b", color: "#b5b2c9" }}><p>Đang mở studio…</p></div>;
}
