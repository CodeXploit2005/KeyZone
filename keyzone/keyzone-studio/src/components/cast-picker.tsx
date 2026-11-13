"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/i18n/client";

export interface CastOption {
  id: string;
  name: string;
  imageUrl: string | null;
  /** The character has a ready reference image. */
  ready: boolean;
}

/**
 * Picks an ordered cast: each click adds a character to the end or takes it out, and the first
 * one is the lead. Posts the ids, comma-separated, under `name`.
 */
export function CastPicker({
  name,
  options,
  defaultIds,
  layout = "cards",
}: {
  name: string;
  options: CastOption[];
  defaultIds: string[];
  layout?: "cards" | "list";
}) {
  const { t } = useI18n();
  const p = t.newProject;
  const [picked, setPicked] = useState(() => defaultIds.filter((id) => options.some((o) => o.id === id)));
  const toggle = (id: string) => setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className={layout === "list" ? "flex min-w-0 flex-col gap-2" : "grid grid-cols-[repeat(auto-fill,minmax(min(100%,112px),1fr))] gap-3"}>
      <input type="hidden" name={name} value={picked.join(",")} />
      {options.map((c) => {
        const order = picked.indexOf(c.id);
        const on = order !== -1;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            aria-pressed={on}
            title={c.ready ? c.name : p.noReference}
            className={`group flex min-w-0 rounded-xl border p-2 text-left transition ${layout === "list" ? "w-full items-center gap-3" : "flex-col gap-2"} ${on ? "border-gold/50 bg-accent-soft/50" : "border-border bg-surface hover:bg-surface-soft"}`}
          >
            <span
              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-soft ${layout === "list" ? "size-14" : "aspect-square w-full"}`}
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={c.name} className="size-full object-cover" />
              ) : (
                <span className="text-gold text-2xl font-bold">{c.name.slice(0, 1)}</span>
              )}
            </span>
            <span className={`flex min-w-0 flex-1 flex-col gap-1 ${layout === "list" ? "items-start" : "items-center"}`}>
              <span className="w-full truncate text-sm font-medium text-foreground">{c.name}</span>
              {on && <span className="whitespace-nowrap rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] leading-4 text-gold-light">{order === 0 ? `1 · ${p.lead}` : order + 1}</span>}
              {!c.ready && <span className="block text-[10px] text-warning/80">{p.noReferenceShort}</span>}
            </span>
            {layout === "list" && <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-gold bg-gold text-white" : "border-border-strong text-transparent"}`} aria-hidden="true"><Check className="size-3" /></span>}
          </button>
        );
      })}
    </div>
  );
}
