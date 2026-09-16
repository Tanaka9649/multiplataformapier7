"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActionKey } from "@/lib/permissions";
import type { Profile } from "@/types/database";

interface RolePermissionRow {
  module_key: string;
  action: string;
  allowed: boolean;
}
interface OverrideRow {
  company_id: string;
  module_key: string;
  action: string;
  allowed: boolean;
}

interface PermissionsContextValue {
  isOwner: boolean;
  loading: boolean;
  /**
   * Mesma cascata do has_permission() no banco: override > perfil > negar.
   * A garantia real é o RLS — isto só decide o que a interface mostra.
   */
  can: (companyId: string | undefined | null, moduleKey: string, action: ActionKey | string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  isOwner: false,
  loading: true,
  can: () => false,
});

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function PermissionsProvider({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const supabase = createClient();
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = profile.system_role === "owner";

  useEffect(() => {
    if (isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: role }, { data: over }] = await Promise.all([
        supabase.rpc("get_my_role_permissions"),
        supabase.rpc("get_my_overrides"),
      ]);
      if (!cancelled) {
        setRolePermissions(role ?? []);
        setOverrides(over ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, profile.permission_profile_id]);

  const roleMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of rolePermissions) map.set(`${r.module_key}:${r.action}`, r.allowed);
    return map;
  }, [rolePermissions]);

  const overrideMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const o of overrides) map.set(`${o.company_id}:${o.module_key}:${o.action}`, o.allowed);
    return map;
  }, [overrides]);

  const can = useMemo(() => {
    return (companyId: string | undefined | null, moduleKey: string, action: string) => {
      if (isOwner) return true;
      if (!companyId) return false;
      const overrideKey = `${companyId}:${moduleKey}:${action}`;
      if (overrideMap.has(overrideKey)) return overrideMap.get(overrideKey)!;
      return roleMap.get(`${moduleKey}:${action}`) ?? false;
    };
  }, [isOwner, overrideMap, roleMap]);

  return (
    <PermissionsContext.Provider value={{ isOwner, loading, can }}>{children}</PermissionsContext.Provider>
  );
}
