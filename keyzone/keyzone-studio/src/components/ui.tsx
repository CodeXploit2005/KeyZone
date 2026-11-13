import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const variants = {
  primary:
    "studio-primary bg-gold text-white font-semibold shadow-sm shadow-violet-500/15 hover:bg-gold-light hover:shadow-md hover:shadow-violet-500/20",
  secondary:
    "bg-surface text-foreground ring-1 ring-inset ring-border shadow-xs hover:bg-accent-soft hover:ring-violet-200 hover:text-gold-light",
  danger:
    "bg-danger/5 text-danger ring-1 ring-inset ring-danger/15 hover:bg-danger/10",
  ghost: "text-muted hover:bg-accent-soft hover:text-gold-light",
};

const sizes = {
  sm: "min-h-8 px-3 text-xs rounded-lg",
  md: "min-h-10 px-4 text-[13px] rounded-lg",
  lg: "min-h-11 px-5 text-sm rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `studio-button inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 ${sizes[size]} ${variants[variant]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  // Autofill extensions can add fdprocessedid before hydration. Ignore attribute
  // differences on this native button only; its children still hydrate normally.
  return <button suppressHydrationWarning type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`glass rounded-2xl ${className}`} {...props} />;
}

export const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle/80 outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/15 disabled:bg-surface-soft disabled:text-subtle";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[13px] font-medium text-foreground/90">{label}</span>
      {children}
      {hint && <span className="text-xs leading-relaxed text-subtle">{hint}</span>}
    </label>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] text-gold uppercase">
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="text-2xl font-bold tracking-[-0.035em] text-foreground md:text-[30px] md:leading-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{children}</h2>
      {aside}
    </div>
  );
}

export type Tone = "gold" | "info" | "success" | "warning" | "danger" | "muted";

const toneClass: Record<Tone, string> = {
  gold: "text-gold-light bg-gold/10 ring-gold/20",
  info: "text-info bg-info/10 ring-info/20",
  success: "text-success bg-success/10 ring-success/20",
  warning: "text-warning bg-warning/10 ring-warning/20",
  danger: "text-danger bg-danger/10 ring-danger/20",
  muted: "text-muted bg-surface-soft ring-slate-200",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] leading-none font-semibold ring-1 ring-inset ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="frost inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted [&_svg]:size-3.5 [&_svg]:text-gold/80">
      {icon}
      {children}
    </span>
  );
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      {icon && (
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-gold [&_svg]:size-6">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      </div>
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`studio-skeleton rounded-lg ${className}`} />;
}

export function NicheSwitcherSkeleton({ mobile = false }: { mobile?: boolean }) {
  return <div aria-hidden="true" className={`frost flex items-center gap-3 rounded-xl p-3 ${mobile ? "h-12" : "h-[76px]"}`}>
    <Skeleton className="size-8 shrink-0" />
    <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-2 w-3/4" /><Skeleton className="h-2 w-1/2" /></div>
  </div>;
}

export function Loading({ variant = "cards" }: { variant?: "cards" | "form" }) {
  if (variant === "form") return (
    <div aria-hidden="true" className="loading-layout glass mt-8 flex flex-col gap-8 rounded-2xl p-5 sm:p-8">
      <div className="flex gap-4"><Skeleton className="size-10 shrink-0" /><div className="flex flex-1 flex-col gap-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-2 w-44 max-w-full" /></div></div>
      <div className="grid gap-6 sm:grid-cols-2">{[0,1].map(i => <div key={i} className="flex flex-col gap-3"><Skeleton className="h-2 w-20" /><div className="rounded-lg border border-border p-4"><Skeleton className="h-3 w-2/3" /></div></div>)}</div>
      <div className="flex flex-col gap-3"><Skeleton className="h-2 w-24" /><div className="flex flex-col gap-3 rounded-lg border border-border p-4"><Skeleton className="h-2 w-4/5" /><Skeleton className="h-2 w-3/5" /></div></div>
      <div className="border-t border-border pt-6"><Skeleton className="h-9 w-28" /></div>
    </div>
  );
  return (
    <div aria-hidden="true" className="loading-layout flex flex-col gap-6">
      <div className="flex flex-col gap-3"><Skeleton className="h-5 w-44" /><Skeleton className="h-2 w-64 max-w-full" /></div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0,1,2].map(i => <div key={i} className="glass flex flex-col gap-5 rounded-2xl p-5">
          <Skeleton className="size-10" />
          <div className="flex flex-col gap-3"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-2/3" /></div>
          <div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-12" /></div>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-4"><Skeleton className="h-2 w-12" /><Skeleton className="h-7 w-24" /></div>
        </div>)}
      </div>
    </div>
  );
}

export function Stat({ label, value, icon, tone = "gold" }: { label: string; value: ReactNode; icon?: ReactNode; tone?: Tone }) {
  return (
    <Card className="flex items-center gap-3.5 px-4 py-4 xl:px-5">
      {icon && (
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClass[tone]} [&_svg]:size-5`}>
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums">{value}</span>
        <span className="mt-1 text-xs text-muted">{label}</span>
      </div>
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/15 bg-danger/5 px-4 py-3 text-sm leading-relaxed break-words text-danger">
      {children}
    </div>
  );
}
