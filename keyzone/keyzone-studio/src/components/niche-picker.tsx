import { asc, count, eq, getTableColumns } from "drizzle-orm";
import { Check, Clapperboard, Clock, Languages, Monitor, Plus, Settings2, Smartphone } from "lucide-react";
import Link from "next/link";
import { selectNiche } from "@/app/actions";
import { db } from "@/db";
import { niches, projects } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { getActiveNiche } from "@/lib/active-niche";
import { Button, Chip, Empty, Eyebrow, buttonClass } from "./ui";
import { NicheEditorLink } from "./niche-editor-link";

export async function NichePicker({ welcome = false }: { welcome?: boolean }) {
  // One grouped query gives every niche with its video count.
  const [rows, active, t] = await Promise.all([
    db
      .select({ ...getTableColumns(niches), videos: count(projects.id) })
      .from(niches)
      .leftJoin(projects, eq(projects.nicheId, niches.id))
      .groupBy(niches.id)
      .orderBy(asc(niches.name)),
    getActiveNiche(),
    getDictionary(),
  ]);
  const heading = welcome ? t.picker.titleWelcome : t.picker.title;

  return (
    <div className="niche-picker flex flex-col gap-8">
      <header className="niche-picker-heading relative flex flex-col items-start gap-3 py-2">
        <Eyebrow>{welcome ? t.picker.eyebrowWelcome : t.picker.eyebrow}</Eyebrow>
        <h1 className="max-w-3xl text-2xl font-bold tracking-tight md:text-3xl">
          {heading.pre}
          <span className="text-gold">{heading.accent}</span>
          {heading.post}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted md:text-base">
          <span className="hidden lg:inline">{t.picker.intro}</span>
          <span className="lg:hidden">{t.picker.mobileIntro}</span>
        </p>
      </header>

      {rows.length === 0 ? (
        <Empty icon={<Clapperboard />} title={t.picker.emptyTitle}>
          <p>
            {t.picker.emptyBefore}
            <code className="text-gold-light">pnpm db:seed</code>
            {t.picker.emptyAfter}
          </p>
          <NicheEditorLink href="/niches/new" sheetTitle={t.picker.newTitle} className={`${buttonClass()} mt-4`}>
            <Plus /> {t.picker.create}
          </NicheEditorLink>
        </Empty>
      ) : (
        <>
        <NicheEditorLink href="/niches/new" sheetTitle={t.picker.newTitle} className={`${buttonClass("secondary")} niche-mobile-create lg:hidden`}>
          <Plus /> {t.picker.newTitle}
        </NicheEditorLink>
        <div className="niche-picker-grid grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((n) => {
            const isActive = active?.id === n.id;
            return (
              <article
                key={n.id}
                className={`niche-card glass group relative flex flex-col overflow-hidden rounded-2xl p-6 transition duration-200 hover:-translate-y-0.5 glass-hover ${
                  isActive ? "gold-ring glow-gold" : ""
                }`}
              >


                <div className="niche-card-top flex items-start justify-between gap-3">
                  <span className="niche-card-icon flex size-14 items-center justify-center rounded-2xl border border-violet-200 bg-accent-soft text-3xl" aria-hidden="true">
                    {n.icon}
                  </span>
                  <div className="niche-card-actions flex items-center gap-1">
                    {isActive && (
                      <span aria-label={t.picker.inUse} title={t.picker.inUse} className="niche-card-active flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-gold-light">
                        <Check className="size-3" /> <span>{t.picker.inUse}</span>
                      </span>
                    )}
                    <NicheEditorLink
                      nicheId={n.id}
                      sheetTitle={n.name}
                      href={`/niches/${n.id}`}
                      title={t.picker.settings}
                      aria-label={`${t.picker.settings}: ${n.name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-subtle transition hover:bg-[rgb(124_58_237/0.06)] hover:text-gold-light"
                    >
                      <Settings2 className="size-4" />
                    </NicheEditorLink>
                  </div>
                </div>

                <h2 className="niche-card-title mt-5 text-xl font-bold tracking-tight">{n.name}</h2>
                <p className="niche-card-description mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{n.description || "—"}</p>

                <div className="niche-card-meta mt-5 flex flex-wrap gap-2">
                  <Chip icon={<Clock />}>{n.sceneCount} × {n.sceneSeconds}s</Chip>
                  <Chip icon={n.defaultAspectRatio === "9:16" ? <Smartphone /> : <Monitor />}>{n.defaultAspectRatio}</Chip>
                  <Chip icon={<Languages />}>{n.language}</Chip>
                </div>

                {n.tone && (
                  <p className="niche-card-tone mt-4 border-l-2 border-gold/30 pl-3 text-xs leading-relaxed text-subtle italic">
                    “{n.tone}”
                  </p>
                )}

                <div className="niche-card-footer mt-6 flex items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-subtle">{t.picker.videos(n.videos)}</span>
                  <form action={selectNiche.bind(null, n.id)}>
                    <Button type="submit" variant={isActive ? "secondary" : "primary"} size="md">
                      {isActive ? t.picker.enter : t.picker.use}
                    </Button>
                  </form>
                </div>
              </article>
            );
          })}

          <Link
            href="/niches/new"
            className="hidden min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-violet-200 p-6 text-center text-muted transition hover:bg-accent-soft/50 hover:text-gold-light lg:flex"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl frost">
              <Plus className="size-5" />
            </span>
            <span className="font-semibold">{t.picker.newTitle}</span>
            <span className="max-w-60 text-xs text-subtle">{t.picker.newBody}</span>
          </Link>
        </div>
        </>
      )}
    </div>
  );
}
