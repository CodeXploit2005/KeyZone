
import { requireLicense } from "@/lib/license";
import type { NextRequest } from "next/server";
import { getProjectView } from "@/lib/views";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  await requireLicense();
  const { id } = await ctx.params;
  const locale = resolveLocale(_req.cookies.get(LOCALE_COOKIE)?.value, _req.headers.get("accept-language"));
  const view = await getProjectView(id, locale);
  if (!view) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
}
