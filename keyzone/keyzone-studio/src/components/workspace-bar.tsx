"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

export function WorkspaceBar() {
  const { t } = useI18n();
  const pathname = usePathname().replace(/^\/(en|vi)(?=\/|$)/, "") || "/";
  const page = pathname.startsWith("/characters")
    ? t.nav.characters
    : pathname.startsWith("/niches")
      ? t.nav.niches
      : pathname === "/projects/new"
        ? t.nav.newVideo
        : pathname.startsWith("/guides")
          ? t.guide.eyebrow
          : t.nav.overview;

  return (
    <div className="workspace-bar hidden items-center justify-between gap-3 px-5 text-xs md:px-8 lg:flex">
      <div className="flex min-w-0 items-center gap-2 text-subtle">
        <Link href="/" className="truncate transition hover:text-gold">{t.workspace.label}</Link>
        <ChevronRight className="size-3 shrink-0 text-subtle/60" />
        <span className="truncate font-medium text-muted">{page}</span>
      </div>
    </div>
  );
}
