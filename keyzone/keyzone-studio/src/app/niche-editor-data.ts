"use server";
import { requireLicense } from "@/lib/license";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { nicheCharacters, niches } from "@/db/schema";
import { getCastOptions } from "@/lib/views";

/** Read the same editor data as the full page; Page credentials stay on the server. */
export async function getNicheEditorData(id?: string) {
  await requireLicense();
  if (!id) return { characters: await getCastOptions(), defaultCastIds: [] as string[] };
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid niche ID");
  const [row, characters] = await Promise.all([
    db.query.niches.findFirst({
      where: eq(niches.id, id),
      with: {
        defaultCast: { orderBy: [asc(nicheCharacters.position)], columns: { characterId: true } },
        facebookPage: { columns: { name: true, instagramUsername: true, instagramId: true } },
      },
    }),
    getCastOptions(),
  ]);
  if (!row) throw new Error("Niche not found");
  const { defaultCast, facebookPage, ...niche } = row;
  return {
    niche,
    characters,
    defaultCastIds: defaultCast.map(c => c.characterId),
    facebookPageName: facebookPage?.name ?? null,
    instagramAccount: facebookPage?.instagramId ? `@${facebookPage.instagramUsername ?? facebookPage.instagramId}` : null,
  };
}
