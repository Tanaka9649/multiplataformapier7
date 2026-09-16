"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Escuta em tempo real a própria linha em `profiles`. Se o status deixar
 * de ser "active" (suspensão, recusa), desloga e redireciona na hora —
 * não espera o próximo login. Funciona porque `profiles` está na
 * publicação supabase_realtime (migration 0010) e a policy de select já
 * permite ao usuário ler a própria linha.
 */
export function SuspensionWatcher({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel(`profile-status-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status;
          if (newStatus && newStatus !== "active") {
            supabase.auth.signOut().finally(() => {
              router.push("/pending");
              router.refresh();
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
