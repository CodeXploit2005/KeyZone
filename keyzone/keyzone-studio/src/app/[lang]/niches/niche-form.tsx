"use client";

import {
  BookOpen,
  Clapperboard,
  Drama,
  ImageIcon,
  Monitor,
  Palette,
  Repeat,
  ScrollText,
  Send,
  Smartphone,
  Tags,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { deleteNiche, saveNiche } from "@/app/actions";
import type { Niche, NicheFormat } from "@/db/schema";
import { Button, Card, ErrorNote, Field, inputClass } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { SubmitButton } from "@/components/submit-button";
import { NICHE_ICON_OPTIONS } from "@/components/niche-icon";
import { CastPicker, type CastOption } from "@/components/cast-picker";
import { ThumbnailPreview } from "@/components/thumbnail-preview";
import { THUMBNAIL_STYLES, type ThumbnailStyle } from "@/lib/thumbnail-styles";

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:p-8">
      <div className="flex flex-col gap-2">
        <span className="flex size-8 items-center text-muted [&_svg]:size-[19px] [&_svg]:stroke-[1.7]">
          {icon}
        </span>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs leading-relaxed text-subtle">{description}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  );
}

export function NicheForm({
  niche,
  characters,
  defaultCastIds,
  facebookPageName,
  instagramAccount,
  onSaved,
}: {
  niche?: Niche;
  characters: CastOption[];
  defaultCastIds: string[];
  /** Name of the connected Facebook Page; its token never reaches the browser. */
  facebookPageName?: string | null;
  /** "@handle" of the Instagram account linked to that Page, when the token may post to it. */
  instagramAccount?: string | null;
  onSaved?: (destination: string) => void;
}) {
  const { t, locale } = useI18n();
  const f = t.nicheForm;
  const [icon, setIcon] = useState(niche?.icon ?? "✦");
  const [format, setFormat] = useState<NicheFormat>(niche?.format ?? "story");
  const [thumbStyle, setThumbStyle] = useState<ThumbnailStyle>(
    (THUMBNAIL_STYLES as readonly string[]).includes(niche?.thumbnailStyle ?? "")
      ? (niche!.thumbnailStyle as ThumbnailStyle)
      : "impact",
  );
  const [accent, setAccent] = useState(niche?.thumbnailAccent ?? "#FFC23D");
  const [brand, setBrand] = useState(niche?.thumbnailBrand ?? "");
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = async (formData: FormData) => {
    if (!onSaved) { await saveNiche(niche?.id ?? null, formData); return; }
    const destination = await saveNiche(niche?.id ?? null, formData, true);
    onSaved(destination);
  };
  const icons = NICHE_ICON_OPTIONS.some((option) => option.value === icon)
    ? NICHE_ICON_OPTIONS
    : [{ value: icon, label: { en: "Current icon", vi: "Biểu tượng hiện tại" } }, ...NICHE_ICON_OPTIONS];

  const onDelete = () => {
    if (!niche || !confirm(f.confirmDelete(niche.name))) return;
    startDelete(async () => {
      setError(null);
      try {
        const destination = await deleteNiche(niche.id, Boolean(onSaved));
        onSaved?.(destination);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <form action={save} className="flex flex-col gap-5">
      {error && <ErrorNote>{error}</ErrorNote>}

      <Section icon={<Tags />} title={f.identity} description={f.identityHint}>
        <Field label={f.icon}>
          <input type="hidden" name="icon" value={icon} />
          <div className="flex flex-wrap gap-2">
            {icons.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setIcon(option.value)}
                title={option.label[locale]}
                aria-label={option.label[locale]}
                aria-pressed={icon === option.value}
                className={`flex size-10 items-center justify-center rounded-lg border transition ${
                  icon === option.value
                    ? "border-violet-300 bg-accent-soft text-gold-light"
                    : "border-border bg-surface text-muted hover:border-slate-300 hover:bg-surface-soft hover:text-foreground"
                }`}
              >
                <span aria-hidden="true" className="text-xl leading-none">{option.value}</span>
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={f.name}>
            <input name="name" required defaultValue={niche?.name} className={inputClass} placeholder={f.namePlaceholder} />
          </Field>
          <Field label="Slug" hint={f.slugHint}>
            <input
              name="slug"
              required
              defaultValue={niche?.slug}
              className={`${inputClass} font-mono`}
              pattern={"[a-z0-9\\-]+"}
              placeholder={f.slugPlaceholder}
            />
          </Field>
        </div>
        <Field label={f.description}>
          <input
            name="description"
            defaultValue={niche?.description}
            className={inputClass}
            placeholder={f.descriptionPlaceholder}
          />
        </Field>
      </Section>

      <Section
        icon={<ScrollText />}
        title={f.script}
        description={f.scriptHint}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-medium">{f.format}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { value: "story" as const, Icon: BookOpen },
              { value: "wordless" as const, Icon: Drama },
              { value: "ambient" as const, Icon: Repeat },
            ].map(({ value, Icon }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-xl frost p-3.5 transition has-checked:ring-1 has-checked:ring-violet-300 has-checked:bg-gold/[0.07]"
              >
                <input
                  type="radio"
                  name="format"
                  value={value}
                  checked={format === value}
                  onChange={() => setFormat(value)}
                  className="sr-only"
                />
                <Icon className="size-5 text-gold" />
                <span>
                  <span className="block text-sm font-medium">{f.formats[value].title}</span>
                  <span className="block text-xs text-subtle">{f.formats[value].sub}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-subtle">{f.formatHint}</p>
          {format === "ambient" && (
            <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl frost p-3.5">
              <input
                type="checkbox"
                name="fixedCamera"
                defaultChecked={niche?.fixedCamera ?? false}
                className="mt-0.5 size-4 accent-violet-600"
              />
              <span>
                <span className="block text-sm font-medium">{f.fixedCamera}</span>
                <span className="block text-xs leading-relaxed text-subtle">{f.fixedCameraHint}</span>
              </span>
            </label>
          )}
        </fieldset>
        <Field label={f.instructions} hint={f.instructionsHint}>
          <textarea
            name="scriptInstructions"
            required
            rows={8}
            defaultValue={niche?.scriptInstructions}
            className={`${inputClass} text-[13px] leading-relaxed`}
            placeholder={f.instructionsPlaceholder}
          />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={f.tone}>
            <input name="tone" defaultValue={niche?.tone} className={inputClass} placeholder={f.tonePlaceholder} />
          </Field>
          <Field label={f.language}>
            <input name="language" required defaultValue={niche?.language ?? "Vietnamese"} className={inputClass} />
          </Field>
        </div>
        {/* Only story videos are narrated: ambient ones play the uploaded soundtrack, wordless ones have no words. */}
        <Field label={f.narratorVoice} hint={f.narratorVoiceHint} className={format === "story" ? "" : "hidden!"}>
          <input
            name="narratorVoiceId"
            defaultValue={niche?.narratorVoiceId ?? ""}
            className={`${inputClass} font-mono`}
            placeholder="voice ID from elevenlabs.io → Voices"
          />
        </Field>
      </Section>

      <Section icon={<Palette />} title={f.visuals} description={f.visualsHint}>
        <Field label={f.visualStyle} hint={f.visualStyleHint}>
          <textarea
            name="visualStyle"
            rows={2}
            defaultValue={niche?.visualStyle}
            className={inputClass}
          />
        </Field>
        {/* Not a Field: a <label> would pass clicks on its text to the first character button. */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-foreground/90">{f.defaultCharacter}</span>
          <CastPicker name="defaultCastIds" options={characters} defaultIds={defaultCastIds} />
          <span className="text-xs leading-relaxed text-subtle">{f.defaultCharacterHint}</span>
        </div>
      </Section>

      <Section icon={<Send />} title={f.facebook} description={f.facebookHint}>
        <Field
          label={f.facebookPageId}
          hint={
            facebookPageName
              ? `${f.facebookConnected(facebookPageName)} ${instagramAccount ? f.instagramConnected(instagramAccount) : f.instagramMissing}`
              : f.facebookPageIdHint
          }
        >
          <input
            name="facebookPageId"
            inputMode="numeric"
            defaultValue={niche?.facebookPageId ?? ""}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label={f.facebookToken} hint={facebookPageName ? f.facebookTokenKeep : f.facebookTokenHint}>
          <input name="facebookPageToken" type="password" autoComplete="off" className={`${inputClass} font-mono`} />
        </Field>
        <Link href="/guides/facebook" target="_blank" className="w-fit text-sm font-medium text-gold hover:text-gold-light">
          {f.facebookGuide}
        </Link>
      </Section>

      <Section icon={<ImageIcon />} title={f.thumbnail} description={f.thumbnailHint}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-medium">{f.thumbnailStyle}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {THUMBNAIL_STYLES.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer flex-col gap-2.5 rounded-xl frost p-2.5 transition has-checked:ring-1 has-checked:ring-violet-300 has-checked:bg-gold/[0.07]"
              >
                <input
                  type="radio"
                  name="thumbnailStyle"
                  value={value}
                  checked={thumbStyle === value}
                  onChange={() => setThumbStyle(value)}
                  className="sr-only"
                />
                <ThumbnailPreview style={value} accent={accent} brand={brand} headline={f.thumbnailSample} />
                <span className="px-1">
                  <span className="block text-sm font-medium">{f.thumbnailStyles[value].title}</span>
                  <span className="block text-xs text-subtle">{f.thumbnailStyles[value].sub}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={f.thumbnailAccent} hint={f.thumbnailAccentHint}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value.toUpperCase())}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                aria-label={f.thumbnailAccent}
              />
              <input
                name="thumbnailAccent"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                pattern="#[0-9a-fA-F]{6}"
                required
                className={inputClass}
              />
            </div>
          </Field>
          <Field label={f.thumbnailBrand} hint={f.thumbnailBrandHint}>
            <input
              name="thumbnailBrand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={32}
              className={inputClass}
              placeholder="My Channel"
            />
          </Field>
        </div>
        <Field label={f.postsInstructions} hint={f.postsInstructionsHint}>
          <textarea
            name="postsInstructions"
            rows={5}
            defaultValue={niche?.postsInstructions}
            className={`${inputClass} text-[13px] leading-relaxed`}
            placeholder={f.postsInstructionsPlaceholder}
          />
        </Field>
      </Section>

      <Section icon={<Clapperboard />} title={f.production} description={f.productionHint}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-medium">{f.defaultFormat}</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "9:16", title: t.common.vertical, sub: t.common.verticalSub, Icon: Smartphone },
              { value: "16:9", title: t.common.horizontal, sub: t.common.horizontalSub, Icon: Monitor },
            ].map(({ value, title, sub, Icon }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-xl frost p-3.5 transition has-checked:ring-1 has-checked:ring-violet-300 has-checked:bg-gold/[0.07]"
              >
                <input
                  type="radio"
                  name="defaultAspectRatio"
                  value={value}
                  defaultChecked={(niche?.defaultAspectRatio ?? "9:16") === value}
                  className="sr-only"
                />
                <Icon className="size-5 text-gold" />
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-subtle">{sub}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={f.sceneCount}>
            <input
              name="sceneCount"
              type="number"
              min={1}
              max={40}
              required
              defaultValue={niche?.sceneCount ?? 6}
              className={inputClass}
            />
          </Field>
          <Field label={f.sceneSeconds} hint={f.sceneSecondsHint}>
            <input
              name="sceneSeconds"
              type="number"
              min={4}
              max={10}
              required
              defaultValue={niche?.sceneSeconds ?? 10}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <div className="mobile-save-bar glass sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl p-3">
        {niche ? (
          <Button variant="danger" onClick={onDelete} disabled={deleting}>
            <Trash /> {f.delete}
          </Button>
        ) : (
          <span className="pl-2 text-xs text-subtle">{f.newNote}</span>
        )}
        <SubmitButton pendingLabel={t.motion.submitting} size="lg">
          {niche ? f.save : f.create}
        </SubmitButton>
      </div>
    </form>
  );
}
