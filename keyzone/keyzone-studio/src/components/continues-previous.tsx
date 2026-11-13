"use client";

import { useI18n } from "@/i18n/client";

export function ContinuesPrevious({ value, onChange }: { value: boolean; onChange: (on: boolean) => void }) {
  const { t } = useI18n();
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl frost p-3">
      <input
        suppressHydrationWarning
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-violet-600"
      />
      <span>
        <span className="block text-xs font-medium">{t.project.continuesPrevious}</span>
        <span className="block text-xs leading-relaxed text-subtle">{t.project.continuesPreviousHint}</span>
      </span>
    </label>
  );
}
