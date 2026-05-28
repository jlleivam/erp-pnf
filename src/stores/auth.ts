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

export function canAccess(roles: AppRole[], allowed: AppRole[]): boolean {
  if (isDirector(roles)) return true;
  return roles.some((r) => allowed.includes(r));
}
