import { Film, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/** Indeterminate visual: it only appears while a real job is running. */
export function ProcessingPanel({ icon, title, body, label, kind = "script" }: {
  icon: ReactNode;
  title: string;
  body: string;
  label: string;
  kind?: "script" | "render";
}) {
  return (
    <div className="processing-panel" data-kind={kind} role="status" aria-live="polite">
      <div className="processing-art" aria-hidden="true">
        <div className="processor-orbit"><span /><span /></div>
        <div className="processor-core">{icon}</div>
        <Sparkles className="processor-spark processor-spark-one" />
        <Sparkles className="processor-spark processor-spark-two" />
      </div>
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
        <p className="max-w-lg text-sm leading-relaxed text-muted">{body}</p>
      </div>
      <div className="processing-filmstrip" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((frame) => <span className="processing-frame" key={frame}><Film /><i /><i /></span>)}
      </div>
      <div className="processing-meter" role="progressbar" aria-label={title}><span /></div>
      <p className="flex items-center justify-center gap-2 text-xs font-medium text-gold"><span className="processing-dot" />{label}</p>
    </div>
  );
}
