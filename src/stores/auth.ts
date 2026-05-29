import { useMemo } from "react";
import { create } from "zustand";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface AuthProfile {
  id: string;
  email: string;
  nombre_completo: string;
  company_id: string | null;
}

interface AuthState {
  userId: string | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  assumedRole: AppRole | null;
  loading: boolean;
  setSession: (data: { userId: string | null; profile: AuthProfile | null; roles: AppRole[] }) => void;
  setAssumedRole: (role: AppRole | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  profile: null,
  roles: [],
  assumedRole: null,
  loading: true,
  setSession: ({ userId, profile, roles }) =>
    set({ userId, profile, roles, loading: false }),
  setAssumedRole: (assumedRole) => set({ assumedRole }),
  setLoading: (loading) => set({ loading }),
  reset: () =>
    set({ userId: null, profile: null, roles: [], assumedRole: null, loading: false }),
}));

export function isDirector(roles: AppRole[]): boolean {
  return roles.includes("director");
}

export function effectiveRole(roles: AppRole[], assumed: AppRole | null): AppRole | null {
  if (isDirector(roles) && assumed) return assumed;
  if (roles.length === 0) return null;
  return roles[0];
}

/**
 * Roles "efectivos" para gating de UI. Si un director está simulando otro rol,
 * la UI se comporta como si solo tuviera ese rol (no incluye "director").
 */
export function effectiveRoles(roles: AppRole[], assumed: AppRole | null): AppRole[] {
  if (isDirector(roles) && assumed) return [assumed];
  return roles;
}

export function effectiveIsDirector(roles: AppRole[], assumed: AppRole | null): boolean {
  return isDirector(roles) && !assumed;
}

/** Hook helper: roles efectivos suscribiéndose al store con referencias estables. */
export function useEffectiveRoles(): AppRole[] {
  const roles = useAuthStore((s) => s.roles);
  const assumed = useAuthStore((s) => s.assumedRole);
  return useMemo(() => effectiveRoles(roles, assumed), [roles, assumed]);
}

/** ¿El usuario actúa como director (rol real y sin simulación)? */
export function useEffectiveIsDirector(): boolean {
  const roles = useAuthStore((s) => s.roles);
  const assumed = useAuthStore((s) => s.assumedRole);
  return useMemo(() => effectiveIsDirector(roles, assumed), [roles, assumed]);
}

/** ¿El usuario es director real, independientemente del rol asumido? */
export function useRealIsDirector(): boolean {
  const roles = useAuthStore((s) => s.roles);
  return useMemo(() => isDirector(roles), [roles]);
}

export function canAccess(roles: AppRole[], allowed: AppRole[]): boolean {
  if (isDirector(roles)) return true;
  return roles.some((r) => allowed.includes(r));
}
