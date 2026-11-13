import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { HealthBadge } from "@/components/health-badge";
import { Wordmark } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { NicheSwitcher } from "@/components/niche-switcher";
import { Sky } from "@/components/sky";
import { LanguageSwitcher } from "@/components/language-switcher";
import { WorkspaceBar } from "@/components/workspace-bar";
import { NavigationMotion } from "@/components/navigation-motion";
import { NicheSwitcherSkeleton } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { VerifiedLicenseGate, StudioLoading } from "@/components/verified-license-gate";
import { LOCALES } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/client";
import { getDictionary, getLocale } from "@/i18n/server";
import "../style-entry.css";


// Apply the saved preference before paint, without waiting for client hydration.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('keyzone-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: { default: "KeyZone Studio", template: "%s · KeyZone" },
    description: t.meta.description,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const [locale, t] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <html lang={locale} suppressHydrationWarning className="h-full antialiased">
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body className="min-h-full font-sans">
        <Suspense fallback={<StudioLoading />}><VerifiedLicenseGate>
        <LocaleProvider locale={locale}>
        <Sky />
        <aside className="studio-sidebar hidden flex-col gap-6 overflow-y-auto px-4 py-6 lg:flex">
          <Link href="/" className="mb-1 px-2">
            <Wordmark />
          </Link>
          <Suspense fallback={<NicheSwitcherSkeleton />}>
            <NicheSwitcher />
          </Suspense>
          <NavLinks />
          <div className="mt-auto flex flex-col gap-4 border-t border-border pt-4">
            <ThemeToggle />
            <HealthBadge />
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="max-w-28 text-[10px] leading-relaxed text-subtle">{t.sidebar.poweredBy}</p>
              <LanguageSwitcher />
            </div>
          </div>
        </aside>

        <header className="mobile-header sticky top-0 z-20 border-b border-border bg-surface lg:hidden">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
            <Link href="/">
              <Wordmark compact />
            </Link>
            <div className="flex items-center gap-2"><Link href="/accounts" aria-label={t.health.manageAccounts} title={t.health.manageAccounts} className="flex size-11 items-center justify-center rounded-xl border border-border text-muted hover:text-gold"><Users className="size-5" /></Link><ThemeToggle compact /><LanguageSwitcher /></div>
          </div>
          <div className="px-4 pb-3">
            <Suspense fallback={<NicheSwitcherSkeleton mobile />}><NicheSwitcher mobile /></Suspense>
          </div>
        </header>

        <div className="min-w-0 lg:pl-[236px]">
          <Suspense fallback={<div className="workspace-bar hidden lg:block" />}>
            <WorkspaceBar />
          </Suspense>
          <main id="studio-content" className="studio-main mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
            <Suspense fallback={null}><NavigationMotion /></Suspense>
            {children}
          </main>
        </div>
        <div className="lg:hidden"><NavLinks orientation="mobile" /></div>
        </LocaleProvider>
        </VerifiedLicenseGate></Suspense>
      </body>
    </html>
  );
}
