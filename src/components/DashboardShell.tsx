"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import type { Company, Profile } from "@/types/database";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { MainNavigation, type DashboardTab } from "@/components/MainNavigation";
import { MetricsGrid } from "@/components/MetricsGrid";
import { MarketingCalendar } from "@/components/MarketingCalendar";
import { SpreadsheetUploader } from "@/components/SpreadsheetUploader";
import { SpreadsheetGallery } from "@/components/SpreadsheetGallery";
import { QualifiedLeadUploader } from "@/components/QualifiedLeadUploader";
import { FileList } from "@/components/FileList";
import { LeadsControl } from "@/components/LeadsControl";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SectionHeader } from "@/components/SectionHeader";
import { SocialMediaSection } from "@/components/social/SocialMediaSection";
import { PermissionsProvider, usePermissions } from "@/lib/usePermissions";
import { SuspensionWatcher } from "@/components/SuspensionWatcher";

const LAST_COMPANY_KEY = "pier7:lastCompany";
const VALID_TABS: DashboardTab[] = ["traffic", "calendar", "spreadsheets", "leads", "leadsControl", "social"];
const TAB_MODULE: Record<DashboardTab, string> = {
  traffic: "traffic",
  calendar: "calendar",
  spreadsheets: "spreadsheets",
  leads: "leads",
  leadsControl: "leads_control",
  social: "social",
};

export function DashboardShell({
  companies,
  userEmail,
  profile,
}: {
  companies: Company[];
  userEmail: string | null;
  profile: Profile;
}) {
  return (
    <PermissionsProvider profile={profile}>
      <SuspensionWatcher userId={profile.id} />
      <DashboardShellInner companies={companies} userEmail={userEmail} profile={profile} />
    </PermissionsProvider>
  );
}

function DashboardShellInner({
  companies,
  userEmail,
  profile,
}: {
  companies: Company[];
  userEmail: string | null;
  profile: Profile;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, loading: permissionsLoading, isOwner } = usePermissions();

  const paramCompany = searchParams.get("company");
  const paramTab = searchParams.get("tab") as DashboardTab | null;

  function visibleTabsFor(companyId: string | undefined) {
    return VALID_TABS.filter((t) => can(companyId, TAB_MODULE[t], "view"));
  }

  const companiesWithAccess = useMemo(() => {
    if (permissionsLoading) return companies; // evita esconder tudo por um instante enquanto carrega
    return companies.filter((c) => visibleTabsFor(c.id).length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, permissionsLoading, can]);

  const initialSlug = useMemo(() => {
    if (paramCompany && companiesWithAccess.some((c) => c.slug === paramCompany)) return paramCompany;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(LAST_COMPANY_KEY);
      if (stored && companiesWithAccess.some((c) => c.slug === stored)) return stored;
    }
    return companiesWithAccess[0]?.slug ?? "";
  }, [paramCompany, companiesWithAccess]);

  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    paramTab && VALID_TABS.includes(paramTab) ? paramTab : "traffic"
  );
  const [spreadsheetRefresh, setSpreadsheetRefresh] = useState(0);
  const [leadRefresh, setLeadRefresh] = useState(0);

  function updateUrl(slug: string, tab: DashboardTab) {
    const params = new URLSearchParams();
    params.set("company", slug);
    params.set("tab", tab);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (activeSlug) {
      updateUrl(activeSlug, activeTab);
      window.localStorage.setItem(LAST_COMPANY_KEY, activeSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém a empresa/aba ativas válidas conforme a permissão carrega —
  // sem loop: só reage a companiesWithAccess mudando, nunca a si mesmo.
  useEffect(() => {
    if (permissionsLoading) return;
    if (!companiesWithAccess.some((c) => c.slug === activeSlug)) {
      const fallback = companiesWithAccess[0]?.slug ?? "";
      setActiveSlug(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading, companiesWithAccess]);

  function handleSelectCompany(slug: string) {
    setActiveSlug(slug);
    window.localStorage.setItem(LAST_COMPANY_KEY, slug);
    const tabs = visibleTabsFor(companies.find((c) => c.slug === slug)?.id);
    const nextTab = tabs.includes(activeTab) ? activeTab : tabs[0] ?? activeTab;
    setActiveTab(nextTab);
    updateUrl(slug, nextTab);
  }

  function handleSelectTab(tab: DashboardTab) {
    setActiveTab(tab);
    updateUrl(activeSlug, tab);
  }

  const activeCompany = companies.find((c) => c.slug === activeSlug) ?? null;
  const activeTabs = visibleTabsFor(activeCompany?.id);

  // Se a aba ativa deixou de ser permitida (ex.: override mudou), pula
  // para a primeira aba ainda visível.
  useEffect(() => {
    if (permissionsLoading || !activeCompany) return;
    if (!activeTabs.includes(activeTab) && activeTabs.length > 0) {
      handleSelectTab(activeTabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading, activeCompany?.id, activeTabs.join(",")]);

  return (
    <div className="min-h-screen bg-[#f7f7f8] transition-colors dark:bg-[#101012]">
      <header className="border-b border-slate-200/70 bg-white transition-colors dark:border-zinc-800/70 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-50">PIER7</span>
            <span className="hidden text-xs text-slate-400 dark:text-zinc-500 sm:inline">
              Plataforma de Marketing
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isOwner && (
              <Link
                href="/admin/users"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
              >
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Administração
              </Link>
            )}
            {userEmail && (
              <span className="hidden text-xs text-slate-400 dark:text-zinc-500 sm:inline">{userEmail}</span>
            )}
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {companies.length === 0 ? (
        <div className="mx-auto max-w-lg px-4 py-16">
          <EmptyState message="Sua conta ainda não tem empresas autorizadas. Peça a um administrador para liberar seu acesso." />
        </div>
      ) : !permissionsLoading && companiesWithAccess.length === 0 ? (
        <div className="mx-auto max-w-lg px-4 py-16">
          <EmptyState message="Você ainda não possui permissões disponíveis. Entre em contato com o administrador." />
        </div>
      ) : (
        <>
          <CompanySwitcher companies={companiesWithAccess} activeSlug={activeSlug} onSelect={handleSelectCompany} />
          <MainNavigation activeTab={activeTab} onSelect={handleSelectTab} visibleTabs={activeTabs} />

          <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
            {activeCompany && (
              <div key={`${activeCompany.id}-${activeTab}`} className="animate-fade-in-up">
                {activeTab === "traffic" && <MetricsGrid company={activeCompany} />}
                {activeTab === "calendar" && <MarketingCalendar company={activeCompany} />}
                {activeTab === "spreadsheets" && (
                  <section>
                    <SectionHeader title="Planilhas" />
                    <SpreadsheetUploader
                      companyId={activeCompany.id}
                      onUploaded={() => setSpreadsheetRefresh((n) => n + 1)}
                    />
                    <SpreadsheetGallery companyId={activeCompany.id} refreshKey={spreadsheetRefresh} />
                  </section>
                )}
                {activeTab === "leads" && (
                  <section>
                    <SectionHeader title="Leads qualificados" />
                    <QualifiedLeadUploader
                      companyId={activeCompany.id}
                      onUploaded={() => setLeadRefresh((n) => n + 1)}
                    />
                    <FileList companyId={activeCompany.id} refreshKey={leadRefresh} />
                  </section>
                )}
                {activeTab === "leadsControl" && <LeadsControl companyId={activeCompany.id} />}
                {activeTab === "social" && <SocialMediaSection company={activeCompany} />}
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}
