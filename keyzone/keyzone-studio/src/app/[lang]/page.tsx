import { asc, desc, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  CheckCheck,
  Clapperboard,
  Clock,
  Film,
  Languages,
  Loader,
  Monitor,
  Palette,
  Plus,
  ScrollText,
  Settings2,
  Smartphone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { projectCharacters, projects, scenes, type Niche } from "@/db/schema";
import { NichePicker } from "@/components/niche-picker";
import { NicheIcon } from "@/components/niche-icon";
import { NicheEditorLink } from "@/components/niche-editor-link";
import { DeleteVideoButton } from "@/components/delete-video-button";
import { StatusBadge } from "@/components/status-badge";
import { buttonClass, Chip, Empty, LinkButton, Loading, Stat } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { getActiveNiche } from "@/lib/active-niche";
import { fileUrl } from "@/lib/storage";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const niche = await getActiveNiche();
  if (!niche) return <NichePicker welcome />;
  return <Dashboard niche={niche} />;
}

async function Dashboard({ niche }: { niche: Niche }) {
  const [[stats], rows, t] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${projects.status} = 'done')::int`,
        working: sql<number>`count(*) filter (where ${projects.status} in ('scripting','producing','rendering'))::int`,
        review: sql<number>`count(*) filter (where ${projects.status} = 'script_ready')::int`,
      })
      .from(projects)
      .where(eq(projects.nicheId, niche.id)),
    db.query.projects.findMany({
      where: eq(projects.nicheId, niche.id),
      orderBy: [desc(projects.createdAt)],
      limit: 60,
      with: {
        cast: {
          orderBy: [asc(projectCharacters.position)],
          with: { character: { columns: { name: true } } },
        },
        // Only the opening scene, as the card thumbnail.
        scenes: {
          columns: { keyframePath: true, updatedAt: true },
          where: eq(scenes.index, 0),
          limit: 1,
        },
      },
    }),
    getDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <NicheHero niche={niche} t={t} />

      <div className="dashboard-stats grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t.dashboard.stats.total} value={stats?.total ?? 0} icon={<Film />} />
        <Stat label={t.dashboard.stats.done} value={stats?.done ?? 0} icon={<CheckCheck />} tone="success" />
        <Stat label={t.dashboard.stats.working} value={stats?.working ?? 0} icon={<Loader />} tone="info" />
        <Stat label={t.dashboard.stats.review} value={stats?.review ?? 0} icon={<ScrollText />} tone="warning" />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight">{t.dashboard.listTitle}</h2>
          <span className="text-xs text-subtle">{t.dashboard.newest}</span>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<Clapperboard />} title={t.dashboard.emptyTitle}>
            <p>{t.dashboard.emptyBody}</p>
            <LinkButton href="/projects/new" className="mt-5"><Plus /> {t.dashboard.firstVideo}</LinkButton>
          </Empty>
        ) : (
          <div className="video-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((p, index) => {
              const opening = p.scenes[0];
              const thumb = fileUrl(opening?.keyframePath ?? null, opening?.updatedAt);
              const action = p.status === "script_ready" ? t.dashboard.reviewScript
                : p.status === "producing" || p.status === "scripting" ? t.dashboard.viewProduction
                : p.status === "rendering" ? t.dashboard.viewRender
                : p.status === "failed" ? t.dashboard.needsAttention : t.dashboard.openVideo;
              return (
                <article key={p.id}
                  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                  className="card-enter video-card glass glass-hover group relative flex min-w-0 flex-col overflow-hidden rounded-2xl p-1.5 transition hover:-translate-y-0.5">
                  <div className="video-card-cover relative aspect-video overflow-hidden rounded-xl bg-accent-soft">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={p.title} loading="lazy" className="video-cover size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-gradient-to-br from-violet-100 via-slate-50 to-violet-50">
                        <span className="flex size-14 items-center justify-center rounded-xl border border-border bg-surface/90 text-muted"><NicheIcon value={niche.icon} className="size-7" /></span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/15 to-transparent" />
                    <div className="absolute top-2 left-2 rounded-md bg-surface/95 shadow-sm"><StatusBadge status={p.status} /></div>
                    <span className="absolute top-2 right-2 rounded-md bg-slate-900/65 px-1.5 py-1 font-mono text-[10px] leading-none text-white">{p.aspectRatio}</span>
                  </div>
                  <div className="video-card-body flex flex-1 flex-col gap-2 px-2.5 pt-3 pb-2.5">
                    <h3 className="line-clamp-2 text-[13px] leading-relaxed font-semibold transition group-hover:text-gold">{p.title}</h3>
                    <div className="video-meta mt-auto flex min-w-0 flex-wrap items-center justify-between gap-2 text-[10px] text-subtle">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {p.cast.length > 0 && <><UserRound className="size-3 shrink-0" /><span className="max-w-28 truncate">{p.cast.map((c) => c.character.name).join(", ")}</span><span className="text-border-strong">·</span></>}
                        <span className="shrink-0">{p.createdAt.toLocaleDateString(t.meta.dateLocale)}</span>
                      </span>
                    </div>
                    <div className="video-card-controls relative z-20 flex items-center justify-between gap-2">
                      <DeleteVideoButton projectId={p.id} title={p.title} />
                      <Link href={`/projects/${p.id}`} className="video-open flex min-h-9 shrink-0 items-center gap-1 text-[10px] font-semibold text-gold">{action}<ArrowRight className="size-3" /></Link>
                    </div>
                  </div>
                  <Link href={`/projects/${p.id}`} className="video-card-link absolute inset-0 z-10 rounded-2xl" aria-label={`${action}: ${p.title}`}><span className="sr-only">{p.title}</span></Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function NicheHero({ niche, t }: { niche: Niche; t: Dictionary }) {
  return (
    <section className="dashboard-hero flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted"><NicheIcon value={niche.icon} className="size-6" /></span>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-xl font-extrabold tracking-[-0.035em] text-foreground md:text-[26px] md:leading-tight">{niche.name}</h1>
            {niche.description && <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted md:text-[13px]">{niche.description}</p>}
          </div>
        </div>
        <div className="dashboard-actions flex flex-wrap gap-2">
          <LinkButton href="/projects/new"><Plus /> {t.dashboard.newVideo}</LinkButton>
          <NicheEditorLink href={`/niches/${niche.id}`} nicheId={niche.id} sheetTitle={niche.name} className={buttonClass("secondary")}><Settings2 /> {t.dashboard.nicheSettings}</NicheEditorLink>
        </div>
      </div>
      <div className="dashboard-meta flex flex-wrap gap-2">
        <Chip icon={<Clock />}>{t.dashboard.duration(niche.sceneCount, niche.sceneSeconds)}</Chip>
        <Chip icon={niche.defaultAspectRatio === "9:16" ? <Smartphone /> : <Monitor />}>{niche.defaultAspectRatio}</Chip>
        <Chip icon={<Languages />}>{niche.language}</Chip>
        {niche.visualStyle && <Chip icon={<Palette />}><span className="max-w-60 truncate">{niche.visualStyle}</span></Chip>}
      </div>
    </section>
  );
}
