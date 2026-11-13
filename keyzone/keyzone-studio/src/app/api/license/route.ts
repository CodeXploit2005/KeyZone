import { NextRequest, NextResponse } from "next/server";
import { activation, LICENSE_COOKIE, licenseRequest, saveActivation } from "@/lib/license";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(LICENSE_COOKIE)?.value;
  const result = token ? await licenseRequest("verify", { token }) : { valid: false, error: "Nhập key để sử dụng KeyZone." };
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  // Browsers may not activate or release a machine from another website.
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  let data;
  try { data = await request.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (typeof data.key !== "string" || data.key.length > 100) return NextResponse.json({ error: "Nhập key hợp lệ." }, { status: 400 });
  const result = await licenseRequest("activate", { key: data.key });
  if (!result.valid || !result.token) return NextResponse.json({ error: result.error }, { status: 403 });
  await saveActivation({ device: (await activation()).device, token: result.token });
  const response = NextResponse.json({ valid: true, customer: result.customer, expiresAt: result.expiresAt });
  response.cookies.set(LICENSE_COOKIE, result.token, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 366 * 86400 });
  return response;
}
