"use client";

import { useI18n } from "@/i18n/client";
import { CircleAlert, CircleCheck, Clock3, LoaderCircle } from "lucide-react";
import { Badge, type Tone } from "./ui";

const dotClass: Record<Tone, string> = {
  gold: "bg-gold",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-subtle",
};

const statusMeta: Record<string, { tone: Tone; live?: boolean }> = {
  scripting: { tone: "gold", live: true },
  script_ready: { tone: "warning" },
  producing: { tone: "info", live: true },
  rendering: { tone: "info", live: true },
  done: { tone: "success" },
  failed: { tone: "danger" },
  pending: { tone: "muted" },
  keyframe: { tone: "info", live: true },
  video: { tone: "info", live: true },
  generating: { tone: "gold", live: true },
  ready: { tone: "success" },
  none: { tone: "muted" },
};

/** Project, scene or character status, with a pulsing dot while work is in progress. */
export function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const { t } = useI18n();
  const meta = statusMeta[status] ?? { tone: "muted" as Tone };
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] leading-4 text-muted">
        <span className={`size-1.5 shrink-0 rounded-full ${dotClass[meta.tone]} ${meta.live ? "animate-pulse motion-reduce:animate-none" : ""}`} />
        {t.status[status] ?? status}
      </span>
    );
  }
  return (
    <Badge tone={meta.tone}>
      {meta.live ? <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
        : status === "done" || status === "ready" ? <CircleCheck className="size-3" />
          : status === "failed" ? <CircleAlert className="size-3" />
            : status === "script_ready" ? <Clock3 className="size-3" />
              : <span className={`size-1.5 rounded-full ${dotClass[meta.tone]}`} />}
      {t.status[status] ?? status}
    </Badge>
  );
}
