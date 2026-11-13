import { asc } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { StatusBadge } from "@/components/status-badge";
import { DeleteCharacterButton } from "@/components/delete-character-button";
import { Empty, LinkButton, Loading, PageHeader } from "@/components/ui";
import { getDictionary } from "@/i18n/server";
import { fileUrl } from "@/lib/storage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).characters.metaTitle };
}

export default async function CharactersPage() {
  const t = await getDictionary();
  return (
    <>
      <PageHeader
        eyebrow={t.characters.eyebrow}
        title={
          <>
            {t.characters.title.pre}
            <span className="text-gold">{t.characters.title.accent}</span>
            {t.characters.title.post}
          </>
        }
        description={t.characters.description}
        actions={
          <LinkButton href="/characters/new">
            <Plus /> {t.characters.new}
          </LinkButton>
        }
      />
      <Suspense fallback={<Loading />}>
        <CharacterList />
      </Suspense>
    </>
  );
}

async function CharacterList() {
  const [rows, t] = await Promise.all([
    db.select().from(characters).orderBy(asc(characters.name)),
    getDictionary(),
  ]);
  if (rows.length === 0) {
    return (
      <Empty icon={<Users />} title={t.characters.emptyTitle}>
        <p>{t.characters.emptyBody}</p>
        <LinkButton href="/characters/new" className="mt-5">
          <Plus /> {t.characters.create}
        </LinkButton>
      </Empty>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {rows.map((c) => {
        const img = fileUrl(c.referenceImagePath, c.updatedAt);
        return (
          <div
            key={c.id}
            className="glass group relative overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1 glass-hover"
          >
          <Link href={`/characters/${c.id}`} className="block" aria-label={c.name}>
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-gradient-to-b from-violet-50 to-slate-100">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={c.name}
                  className="size-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="text-gold text-6xl font-extrabold">{c.name.slice(0, 1)}</span>
              )}
            </div>
          </Link>
          <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3.5 py-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={`/characters/${c.id}`} className="truncate text-sm font-semibold leading-5 text-foreground hover:text-gold-light" title={c.name}>{c.name}</Link>
              <StatusBadge status={c.referenceStatus} compact />
            </div>
            <DeleteCharacterButton id={c.id} name={c.name} />
          </div>
          </div>
        );
      })}
    </div>
  );
}
