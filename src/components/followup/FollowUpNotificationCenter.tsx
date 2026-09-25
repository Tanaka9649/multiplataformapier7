"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import type { FollowUpNotification } from "@/types/database";
import { formatFollowUpMoment, formatRelativeDeadline, getDeadlineBadgeVariant } from "@/lib/followUp";
import { cx } from "@/lib/utils";

export function FollowUpNotificationCenter() {
  const supabase = createClient();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FollowUpNotification[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("follow_up_notifications")
      .select("*")
      .order("deadline_at", { ascending: true })
      .limit(60);
    setNotifications((data ?? []) as FollowUpNotification[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 45_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const unread = notifications.filter((notification) => !notification.read_at).length;

  async function openLead(notification: FollowUpNotification) {
    await supabase.from("follow_up_notification_reads").upsert({
      schedule_id: notification.schedule_id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      read_at: new Date().toISOString(),
    });
    setOpen(false);
    router.push(`/dashboard?company=${encodeURIComponent(notification.company_slug)}&tab=followUp&lead=${notification.lead_id}`);
    load();
  }

  async function markAllRead() {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    await supabase.from("follow_up_notification_reads").upsert(
      notifications.filter((notification) => !notification.read_at).map((notification) => ({ schedule_id: notification.schedule_id, user_id: userId, read_at: new Date().toISOString() }))
    );
    load();
  }

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Notificações de follow-up" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-900">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
            <div><p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Follow-ups próximos</p><p className="text-[11px] text-slate-400">Atualização automática a cada 45 segundos</p></div>
            {unread > 0 && <button type="button" onClick={markAllRead} title="Marcar todas como lidas" className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"><CheckCheck className="h-4 w-4" /></button>}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-zinc-500">Nenhum alerta nas próximas 2 horas.</p> : notifications.map((notification) => (
              <button key={notification.schedule_id} type="button" onClick={() => openLead(notification)} className={cx("block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60", !notification.read_at && "bg-brand-50/50 dark:bg-brand-950/20")}>
                <div className="flex items-start justify-between gap-3"><span className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">{notification.lead_name}</span><StatusBadge variant={getDeadlineBadgeVariant(notification.deadline_at)} className="shrink-0 text-[11px]">{formatRelativeDeadline(notification.deadline_at)}</StatusBadge></div>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{notification.company_name} · {notification.stage_number}º follow-up</p>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">Prazo: {formatFollowUpMoment(notification.deadline_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
