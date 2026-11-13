import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { LICENSE_COOKIE, licenseRequest } from "@/lib/license";

// URLs stay locale-free (/projects/123); the proxy rewrites them to app/[lang]
// using the saved choice or the browser's Accept-Language, falling back to English.
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/api/license" || pathname === "/api/local-instance") return NextResponse.next();
  const token = request.cookies.get(LICENSE_COOKIE)?.value;
  const license = token ? await licenseRequest("verify", { token }) : { valid: false };
  const activationPage = /^\/(?:en\/|vi\/)?activate\/?$/.test(pathname);
  if (!license.valid && !activationPage) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Cần key còn hiệu lực." }, { status: 403 });
    return NextResponse.redirect(new URL("/activate", request.url));
  }
  if (license.valid && activationPage) return NextResponse.redirect(new URL("/", request.url));
  if (pathname.startsWith("/api/")) return NextResponse.next();
  const locale = resolveLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  const url = request.nextUrl.clone();
  if (!/^\/(en|vi)(\/|$)/.test(url.pathname)) url.pathname = `/${locale}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (icon.svg, images…).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
