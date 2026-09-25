"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Company, SocialMediaPeriod, SocialNetwork, SocialStoryWeek } from "@/types/database";
import { SectionHeader } from "@/components/SectionHeader";
import { MetricsGridSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { PeriodSelector } from "@/components/social/PeriodSelector";
import { SocialMetricCard } from "@/components/social/SocialMetricCard";
import { StoriesWeeklyChart } from "@/components/social/StoriesWeeklyChart";
import { EditSocialMetricsModal } from "@/components/social/EditSocialMetricsModal";
import { SocialTopContents } from "@/components/social/SocialTopContents";
import {
  METRIC_FIELDS_BY_NETWORK,
  PRODUCTION_FIELDS_BY_NETWORK,
  SOCIAL_NETWORK_LABELS,
  getSocialNetworksForCompany,
} from "@/lib/socialMedia";
import { BUTTON_SECONDARY, cx } from "@/lib/utils";
import { usePermissions } from "@/lib/usePermissions";

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function prevYearMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function SocialMediaSection({ company }: { company: Company }) {
  const supabase = createClient();
  const { showToast } = useToast();
  const { can, isOwner } = usePermissions();
  const canEditMetrics = isOwner || can(company.id, "social", "edit_metrics");
  const canAddContent = isOwner || can(company.id, "social", "add_content");
  const canEditContent = isOwner || can(company.id, "social", "edit_content");
  const canDeleteContent = isOwner || can(company.id, "social", "delete_content");

  const networks = getSocialNetworksForCompany(company.slug);
  const [network, setNetwork] = useState<SocialNetwork>(networks[0]);
  const [{ year, month }, setPeriod] = useState(currentYearMonth());

  const [period, setPeriodRow] = useState<SocialMediaPeriod | null>(null);
  const [previousPeriod, setPreviousPeriod] = useState<SocialMediaPeriod | null>(null);
  const [storyWeeks, setStoryWeeks] = useState<SocialStoryWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  // garante que a rede ativa é sempre válida para a empresa selecionada
  useEffect(() => {
    if (!networks.includes(network)) setNetwork(networks[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prev = prevYearMonth(year, month);

      const [{ data: currentRow, error: currentError }, { data: prevRow, error: prevError }] = await Promise.all([
        supabase
          .from("social_media_periods")
          .select("*")
          .eq("company_id", company.id)
          .eq("network", network)
          .eq("year", year)
          .eq("month", month)
          .maybeSingle(),
        supabase
          .from("social_media_periods")
          .select("*")
          .eq("company_id", company.id)
          .eq("network", network)
          .eq("year", prev.year)
          .eq("month", prev.month)
          .maybeSingle(),
      ]);
      if (currentError) throw currentError;
      if (prevError) throw prevError;

      setPeriodRow(currentRow ?? null);
      setPreviousPeriod(prevRow ?? null);

      if (network === "instagram" && currentRow) {
        const { data: weeks, error: weeksError } = await supabase
          .from("social_story_weeks")
          .select("*")
          .eq("social_period_id", currentRow.id)
          .order("week_number", { ascending: true });
        if (weeksError) throw weeksError;
        setStoryWeeks(weeks ?? []);
      } else {
        setStoryWeeks([]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível carregar os dados de redes sociais.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, network, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const metricFields = METRIC_FIELDS_BY_NETWORK[network];
  const productionFields = PRODUCTION_FIELDS_BY_NETWORK[network];
  const hasStoryData = storyWeeks.some((w) => w.average_views > 0);
  const storiesAverage =
    storyWeeks.length > 0
      ? Math.round(storyWeeks.reduce((sum, w) => sum + w.average_views, 0) / storyWeeks.length)
      : null;

  return (
    <section>
      <SectionHeader
        title="Redes Sociais"
        subtitle="Preenchimento manual"
        action={
          canEditMetrics && <button onClick={() => setEditOpen(true)} className={BUTTON_SECONDARY}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
            Editar métricas
          </button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {networks.length > 1 ? (
          <div className="inline-flex rounded-xl border border-slate-200/70 bg-white p-1 dark:border-zinc-800/70 dark:bg-zinc-900">
            {networks.map((n) => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className={cx(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
                  n === network
                    ? "bg-brand-50 text-brand-800 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                {SOCIAL_NETWORK_LABELS[n]}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">
            {SOCIAL_NETWORK_LABELS[network]}
          </span>
        )}

        <PeriodSelector year={year} month={month} onChange={(y, m) => setPeriod({ year: y, month: m })} />
      </div>

      {loading ? (
        <MetricsGridSkeleton />
      ) : (
        <div key={`${network}-${year}-${month}`} className="animate-fade-in-up space-y-8">
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
            {metricFields.map((field) => (
              <SocialMetricCard
                key={field.key}
                label={field.label}
                value={period ? (period as any)[field.key] : null}
                previousValue={previousPeriod ? (previousPeriod as any)[field.key] : null}
                metricKey={field.key}
              />
            ))}
          </div>

          {network === "instagram" && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-zinc-200">
                Stories {storiesAverage !== null && hasStoryData && (
                  <span className="ml-1 font-normal text-slate-400 dark:text-zinc-500">
                    · média mensal: {new Intl.NumberFormat("pt-BR").format(storiesAverage)}
                  </span>
                )}
              </h3>
              {hasStoryData ? (
                <StoriesWeeklyChart weeks={storyWeeks} />
              ) : (
                <p className="text-sm text-slate-400 dark:text-zinc-500">
                  Nenhum dado de Stories cadastrado para este período.
                </p>
              )}
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-zinc-200">Produção do mês</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {productionFields.map((field) => (
                <SocialMetricCard
                  key={field.key}
                  label={field.label}
                  value={period ? (period as any)[field.key] : null}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <SocialTopContents
        companyId={company.id}
        network={network}
        year={year}
        month={month}
        canAdd={canAddContent}
        canEdit={canEditContent}
        canDelete={canDeleteContent}
      />

      <EditSocialMetricsModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        companyId={company.id}
        network={network}
        year={year}
        month={month}
        period={period}
        storyWeeks={storyWeeks}
        onSaved={load}
      />
    </section>
  );
}
