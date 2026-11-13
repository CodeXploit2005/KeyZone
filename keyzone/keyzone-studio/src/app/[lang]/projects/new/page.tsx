import { asc, eq } from "drizzle-orm";
import { Clock, Compass, Languages, Monitor, Palette, Smartphone, WandSparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { createProject } from "@/app/actions";
import { db } from "@/db";
import { characters, nicheCharacters } from "@/db/schema";
import { CastPicker } from "@/components/cast-picker";
import { ReferenceImageUpload } from "@/components/reference-image-upload";
import { SceneCountField } from "@/components/scene-count-field";
import { SoundtrackUpload } from "@/components/soundtrack-upload";
import { PromptComposer, ProductSubmitButton } from "@/components/product-reference";
import { ProjectCreationModes } from "@/components/project-creation-modes";
import { NicheIcon } from "@/components/niche-icon";
import { NicheEditorLink } from "@/components/niche-editor-link";
import { Card, Chip, Empty, Eyebrow, inputClass, LinkButton, Loading, PageHeader } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { getActiveNiche } from "@/lib/active-niche";
import { MAX_PROJECT_SCENES } from "@/lib/pipeline/prompts";
import { fileUrl } from "@/lib/storage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).newProject.metaTitle };
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<Loading variant="form" />}>
      <NewProject />
    </Suspense>
  );
}

const formats = (t: Dictionary) =>
  [
    { value: "9:16", title: t.common.vertical, sub: t.common.verticalSub, Icon: Smartphone, frame: "h-12 w-7" },
    { value: "16:9", title: t.common.horizontal, sub: t.common.horizontalSub, Icon: Monitor, frame: "h-7 w-12" },
  ] as const;

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="bg-gold flex size-7 items-center justify-center rounded-full text-xs font-bold text-white">
          {n}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

async function NewProject() {
  const [niche, t] = await Promise.all([getActiveNiche(), getDictionary()]);
  const p = t.newProject;
  if (!niche) {
    return (
      <Empty icon={<Compass />} title={p.pickNicheTitle}>
        <p>{p.pickNicheBody}</p>
        <LinkButton href="/niches" className="mt-5">
          {p.pickNiche}
        </LinkButton>
      </Empty>
    );
  }

  const [characterRows, defaultCast] = await Promise.all([
    db.select().from(characters).orderBy(asc(characters.name)),
    db
      .select({ id: nicheCharacters.characterId })
      .from(nicheCharacters)
      .where(eq(nicheCharacters.nicheId, niche.id))
      .orderBy(asc(nicheCharacters.position)),
  ]);
  const defaultCastIds = defaultCast.map((c) => c.id);
  const sceneMinutes = `${niche.sceneCount * 2}–${niche.sceneCount * 4}`;
  const ambient = niche.format === "ambient" ? p.ambient : null;

  return (
    <>
      <PageHeader
        eyebrow={niche.name}
        title={
          <>
            {p.title.pre}
            <span className="text-gold">{p.title.accent}</span>
            {p.title.post}
          </>
        }
        description={p.description}
      />

      <ProjectCreationModes niche={{ id: niche.id, name: niche.name, defaultAspectRatio: niche.defaultAspectRatio }} characters={characterRows.map(c => ({ id: c.id, name: c.name, imageUrl: fileUrl(c.referenceImagePath, c.updatedAt), ready: c.referenceStatus === "ready" }))}>
      <form action={createProject} className="creation-form grid gap-6 lg:grid-cols-[1fr_320px]">
        <input type="hidden" name="nicheId" value={niche.id} />

        <Card className="creation-fields flex flex-col gap-10 p-6 md:p-8">
          <Step n={1} title={ambient?.stepPlace ?? p.stepTopic}>
            <PromptComposer attachments={!ambient}><textarea
              name="topic"
              required
              minLength={3}
              rows={4}
              className={`${inputClass} text-base leading-relaxed`}
              placeholder={ambient?.placePlaceholder ?? p.topicPlaceholder}
            />
            </PromptComposer>
            <p className="text-xs text-subtle">{ambient?.placeHint ?? p.topicHint}</p>
          </Step>

          {ambient && (
            <Step n={2} title={ambient.stepSoundtrack}>
              <SoundtrackUpload name="audioPath" />
            </Step>
          )}

          {ambient && (
            <Step n={3} title={p.reference.step}>
              <p className="-mt-1 text-xs leading-relaxed text-subtle">{p.reference.hint}</p>
              <ReferenceImageUpload name="referenceImagePath" />
            </Step>
          )}

          <Step n={ambient ? 4 : 2} title={p.stepFormat}>
            <div className="grid grid-cols-2 gap-3">
              {formats(t).map(({ value, title, sub, frame }) => (
                <label
                  key={value}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl frost p-3 transition hover:bg-accent-soft has-checked:ring-1 has-checked:ring-violet-300 has-checked:bg-accent-soft sm:gap-4 sm:p-4"
                >
                  <input
                    type="radio"
                    name="aspectRatio"
                    value={value}
                    defaultChecked={niche.defaultAspectRatio === value}
                    className="peer sr-only"
                  />
                  <span className="hidden size-12 shrink-0 items-center justify-center sm:flex">
                    <span
                      className={`${frame} rounded-md border-2 border-subtle transition group-has-checked:ring-1 group-has-checked:ring-violet-300 group-has-checked:bg-gold/15`}
                    />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-subtle">{sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </Step>

          {/* Ambient shots are about the place; a cast can still come from the niche default. */}
          {ambient ? (
            <input type="hidden" name="castIds" value={defaultCastIds.join(",")} />
          ) : (
            <Step n={3} title={p.stepCharacter}>
              <CastPicker
                name="castIds"
                defaultIds={defaultCastIds}
                options={characterRows.map((c) => ({
                  id: c.id,
                  name: c.name,
                  imageUrl: fileUrl(c.referenceImagePath, c.updatedAt),
                  ready: c.referenceStatus === "ready",
                }))}
              />
              <p className="text-xs text-subtle">
                {p.characterHint}{" "}
                <Link href="/characters/new" className="text-gold-light hover:underline">
                  {p.newCharacter}
                </Link>
              </p>
            </Step>
          )}

          {/* Ambient videos run as long as their soundtrack, so their shot count stays the niche's. */}
          {!ambient && (
            <Step n={4} title={p.stepSceneCount}>
              <SceneCountField
                name="sceneCount"
                defaultCount={niche.sceneCount}
                sceneSeconds={niche.sceneSeconds}
                max={MAX_PROJECT_SCENES}
              />
            </Step>
          )}
        </Card>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
          <Card className="gold-ring flex flex-col gap-4 p-5">
            <Eyebrow>{p.nicheSettings}</Eyebrow>
            <div className="flex items-center gap-3">
              <NicheIcon value={niche.icon} className="size-6 shrink-0 text-muted" />
              <div>
                <div className="font-semibold">{niche.name}</div>
                <NicheEditorLink href={`/niches/${niche.id}`} nicheId={niche.id} sheetTitle={niche.name} className="text-xs text-gold-light hover:underline">
                  {p.editSettings}
                </NicheEditorLink>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip icon={<Clock />}>
                {niche.sceneCount} × {niche.sceneSeconds}s
              </Chip>
              <Chip icon={<Languages />}>{niche.language}</Chip>
            </div>
            {niche.tone && (
              <p className="text-xs leading-relaxed text-muted">
                <span className="text-subtle">{p.tone}</span>
                {niche.tone}
              </p>
            )}
            {niche.visualStyle && (
              <p className="flex gap-2 text-xs leading-relaxed text-muted">
                <Palette className="mt-0.5 size-3.5 shrink-0 text-gold/80" />
                {niche.visualStyle}
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5 text-xs text-muted">
            <div className="flex justify-between">
              <span>{p.scripting}</span>
              <span className="text-foreground">{p.scriptingTime}</span>
            </div>
            <div className="flex justify-between">
              <span>{ambient ? ambient.shots(niche.sceneCount) : p.production(niche.sceneCount)}</span>
              <span className="text-foreground">{p.productionTime(sceneMinutes)}</span>
            </div>
            <div className="flex justify-between">
              <span>{p.length}</span>
              <span className="text-foreground">
                {ambient ? ambient.lengthValue : `~${niche.sceneCount * niche.sceneSeconds}s`}
              </span>
            </div>
          </Card>

          <ProductSubmitButton pendingLabel={t.motion.submitting} size="lg" className="w-full">
            <WandSparkles /> {ambient?.submit ?? p.submit}
          </ProductSubmitButton>
        </aside>
      </form>
      </ProjectCreationModes>
    </>
  );
}
