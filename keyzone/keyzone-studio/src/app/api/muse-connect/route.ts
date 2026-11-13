
import { requireLicense } from "@/lib/license";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE = "moonreel_muse_connect";
const noStore = { "Cache-Control": "no-store" };

async function upstream(path: string, method = "GET", body?: unknown, timeout = 45_000) {
  const config = env();
  const response = await fetch(`${config.MUSE2API_BASE_URL.replace(/\/+$/, "")}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.MUSE2API_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
  });
  const data = await response.json();
  return { response, data };
}

export async function GET() {
  await connection();
  await requireLicense();
  try {
    const { response, data } = await upstream("/admin/accounts");
    if (!response.ok) return Response.json({ error: "Không tải được danh sách tài khoản." }, { status: 502, headers: noStore });
    return Response.json({ accounts: (data.accounts ?? []).map((a: { id: string; label: string; enabled: boolean; ok: boolean | null; expires_at?: number; workspace_status?: string; workspace_checked_at?: number }) => ({
      id: a.id, label: a.label, enabled: a.enabled, ok: a.ok, expires_at: a.expires_at,
      workspace_status: a.workspace_status ?? "unknown", workspace_checked_at: a.workspace_checked_at,
    })) }, { headers: noStore });
  } catch {
    return Response.json({ error: "Không kết nối được dịch vụ Muse." }, { status: 502, headers: noStore });
  }
}

export async function POST(request: Request) {
  await requireLicense();
  // Browser-session capability stays in an HttpOnly cookie; never expose the admin key.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403, headers: noStore });
  }
  const jar = await cookies();
  try {
    const body = await request.json();
    if (body.action === "check") {
      if (typeof body.account_id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.account_id)) {
        return Response.json({ error: "Tài khoản không hợp lệ." }, { status: 400, headers: noStore });
      }
      const { response, data } = await upstream(`/admin/accounts/${encodeURIComponent(body.account_id)}/test`, "POST", undefined, 90_000);
      if (!response.ok) return Response.json({ error: "Chưa kiểm tra được tài khoản. Vui lòng thử lại." }, { status: response.status, headers: noStore });
      return Response.json({ ok: data.ok === true }, { headers: noStore });
    }
    if (body.action === "delete") {
      if (typeof body.account_id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.account_id)) {
        return Response.json({ error: "Tài khoản không hợp lệ." }, { status: 400, headers: noStore });
      }
      const { response, data } = await upstream(`/admin/accounts/${encodeURIComponent(body.account_id)}`, "DELETE");
      if (!response.ok) return Response.json({ error: response.status === 404 ? "Tài khoản đã được gỡ trước đó. Hãy tải lại danh sách." : "Không xóa được kết nối. Vui lòng thử lại." }, { status: response.status, headers: noStore });
      if (data.deleted !== true) return Response.json({ error: "Dịch vụ chưa xác nhận xóa kết nối. Vui lòng thử lại." }, { status: 502, headers: noStore });
      return Response.json({ ok: true, deleted: data.deleted === true }, { headers: noStore });
    }
    const sid = jar.get(COOKIE)?.value;
    const options = { httpOnly: true, sameSite: "strict" as const, secure: new URL(request.url).protocol === "https:", path: "/api/muse-connect", maxAge: 900 };
    // Opening the accounts page without an unfinished sign-in is a normal state.
    if (body.action === "resume") {
      if (!sid) return Response.json({ active: false }, { headers: noStore });
      const { response } = await upstream(`/admin/connect/${encodeURIComponent(sid)}`);
      if (response.status === 410) {
        jar.set(COOKIE, "", { ...options, maxAge: 0 });
        return Response.json({ active: false }, { headers: noStore });
      }
      if (!response.ok) return Response.json({ error: "Chưa kiểm tra được phiên đăng nhập. Vui lòng thử lại." }, { status: 502, headers: noStore });
      return Response.json({ active: true }, { headers: noStore });
    }
    if (body.action === "cancel" && !sid) return Response.json({ ok: true }, { headers: noStore });
    if (body.action === "start") {
      if (sid) await upstream(`/admin/connect/${encodeURIComponent(sid)}`, "DELETE");
      const { response, data } = await upstream("/admin/connect", "POST", { replace_id: body.replace_id || null });
      if (!response.ok) return Response.json({ error: data.detail || "Không mở được phiên đăng nhập." }, { status: response.status, headers: noStore });
      jar.set(COOKIE, data.id, options);
      return Response.json({ ok: true, expires_in: data.expires_in }, { headers: noStore });
    }
    if (!sid) return Response.json({ error: "Phiên đã hết hạn. Hãy kết nối lại." }, { status: 410, headers: noStore });
    const path = `/admin/connect/${encodeURIComponent(sid)}`;
    const action = body.action;
    if (!["state", "input", "complete", "cancel"].includes(action)) {
      return Response.json({ error: "Thao tác không hợp lệ." }, { status: 400, headers: noStore });
    }
    const { response, data } = await upstream(
      path + (action === "input" ? "/input" : action === "complete" ? "/complete" : ""),
      action === "state" ? "GET" : action === "cancel" ? "DELETE" : "POST",
      action === "input" ? body.input : action === "complete" ? { label: body.label } : undefined,
    );
    if (action === "cancel" || (action === "complete" && response.ok) || response.status === 410) jar.set(COOKIE, "", { ...options, maxAge: 0 });
    return Response.json(response.ok ? data : { error: typeof data.detail === "string" ? data.detail : "Thao tác chưa thành công." }, { status: response.status, headers: noStore });
  } catch {
    return Response.json({ error: "Kết nối bị gián đoạn. Vui lòng thử lại." }, { status: 502, headers: noStore });
  }
}
