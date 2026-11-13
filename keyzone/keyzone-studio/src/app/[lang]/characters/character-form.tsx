"use client";

import { Image as ImageIcon, Trash, Upload, WandSparkles } from "lucide-react";
import { useState } from "react";
import { deleteCharacter, saveCharacter } from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { Button, Card, ErrorNote, Field, inputClass } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { SubmitButton } from "@/components/submit-button";

export interface CharacterFormValue {
  id: string;
  name: string;
  appearance: string;
  personality: string;
  referenceStatus: string;
  referenceError: string | null;
  referenceUrl: string | null;
}

type Mode = "keep" | "upload" | "generate";

export function CharacterForm({ character }: { character?: CharacterFormValue }) {
  const { t } = useI18n();
  const f = t.characterForm;
  const [mode, setMode] = useState<Mode>(character ? "keep" : "generate");
  const [preview, setPreview] = useState<string | null>(null);
  const save = saveCharacter.bind(null, character?.id ?? null);

  const modes = [
    { value: "keep" as const, label: f.keep, Icon: ImageIcon, hidden: !character },
    { value: "generate" as const, label: f.generate, Icon: WandSparkles },
    { value: "upload" as const, label: f.upload, Icon: Upload },
  ].filter((m) => !m.hidden);

  const shown = mode === "upload" ? preview : mode === "keep" ? character?.referenceUrl : null;

  return (
    <form action={save} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <Field label={f.name}>
          <input name="name" required defaultValue={character?.name} className={inputClass} placeholder={f.namePlaceholder} />
        </Field>
        <Field
          label={f.appearance}
          hint={f.appearanceHint}
        >
          <textarea
            name="appearance"
            required
            rows={6}
            defaultValue={character?.appearance}
            className={`${inputClass} leading-relaxed`}
            placeholder="A friendly old philosopher, 3D Pixar style, long white beard, bald head, kind eyes, blue and cream toga, brown leather sandals"
          />
        </Field>
        <Field label={f.personality}>
          <textarea
            name="personality"
            rows={2}
            defaultValue={character?.personality}
            className={inputClass}
            placeholder={f.personalityPlaceholder}
          />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-[13px] font-medium">{f.reference}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {modes.map(({ value, label, Icon }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl frost px-3.5 py-3 text-sm transition hover:bg-[rgb(124_58_237/0.07)] has-checked:ring-1 has-checked:ring-violet-300 has-checked:bg-gold/[0.07] has-checked:text-gold-light"
              >
                <input
                  type="radio"
                  name="referenceMode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                <Icon className="size-4 text-gold" />
                {label}
              </label>
            ))}
          </div>
          {mode === "upload" && (
            <input
              type="file"
              name="referenceImage"
              accept="image/png,image/jpeg,image/webp"
              required
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gold-light hover:file:bg-gold/25"
            />
          )}
          {mode === "generate" && (
            <p className="text-xs text-subtle">{f.generateHint}</p>
          )}
        </fieldset>
      </Card>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
        <Card className="gold-ring overflow-hidden p-0">
          <div className="flex aspect-[3/4] items-center justify-center bg-gradient-to-b from-violet-50 to-slate-100">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 text-center text-xs text-subtle">
                <WandSparkles className="size-8 text-gold/60" />
                {mode === "generate" ? f.previewGenerate : f.noImage}
              </div>
            )}
          </div>
          {character && (
            <div className="flex flex-col gap-2 p-4">
              <StatusBadge status={character.referenceStatus} />
              {character.referenceError && <ErrorNote>{character.referenceError}</ErrorNote>}
            </div>
          )}
        </Card>

        <SubmitButton pendingLabel={t.motion.submitting} size="lg" className="w-full">
          {character ? f.save : f.create}
        </SubmitButton>
        {character && (
          <Button
            variant="danger"
            formAction={deleteCharacter.bind(null, character.id)}
            formNoValidate
            type="submit"
            className="w-full"
            onClick={(e) => !confirm(f.confirmDelete) && e.preventDefault()}
          >
            <Trash /> {f.delete}
          </Button>
        )}
      </aside>
    </form>
  );
}
