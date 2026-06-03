import type { Session } from "@supabase/supabase-js";

import { supabase } from "../api/supabase";
import type { Profile, UserRole } from "../store/useAuthStore";
import { useAuthStore } from "../store/useAuthStore";

export type RoleHomeRoute = "/(admin)" | "/(librarian)" | "/(member)";
export type RoleRouteGroup = "(admin)" | "(librarian)" | "(member)";

export const getHomeRouteForRole = (role?: UserRole): RoleHomeRoute => {
  if (role === "ADMIN") return "/(admin)";
  if (role === "LIBRARIAN") return "/(librarian)";
  return "/(member)";
};

export const getRouteGroupForProfile = (
  profile?: Pick<Profile, "role" | "is_super_admin"> | null,
): RoleRouteGroup => {
  if (profile?.is_super_admin) return "(admin)";
  if (profile?.role === "ADMIN") return "(admin)";
  if (profile?.role === "LIBRARIAN") return "(librarian)";
  return "(member)";
};

export const getHomeRouteForProfile = (
  profile?: Pick<Profile, "role" | "is_super_admin"> | null,
): RoleHomeRoute => `/${getRouteGroupForProfile(profile)}` as RoleHomeRoute;

export const syncSessionAndGetHomeRoute = async (
  session: Session,
): Promise<RoleHomeRoute> => {
  await useAuthStore.getState().setSession(session);
  return getHomeRouteForProfile(useAuthStore.getState().profile);
};

export const syncCurrentSessionAndGetHomeRoute =
  async (): Promise<RoleHomeRoute | null> => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session) return null;

    return syncSessionAndGetHomeRoute(session);
  };
