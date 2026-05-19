import { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { supabase } from "../api/supabase";
import { persistence } from "../core/persistence";

export type UserRole = "MEMBER" | "LIBRARIAN" | "ADMIN" | null;

export interface Profile {
  id: string;
  fullName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  favoriteGenres: string[];
  xp: number;
  level: number;
  badges?: any[];
  is_locked: boolean;
  lock_reason: string | null;
  locale: string | null;
  email?: string | null;
  is_super_admin?: boolean;
  membershipType: "BASIC" | "PLATINUM";
}

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  i18nInitialized: boolean;
}

export interface AuthActions {
  setSession: (session: Session | null) => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateAvatar: (url: string) => void;
  updateProfile: (
    data: Partial<
      Pick<Profile, "fullName" | "bio" | "favoriteGenres" | "locale">
    >,
  ) => void;
  updateLocale: (locale: string) => void;
  logout: () => Promise<void>;
  forceInitialize: () => void;
  setI18nInitialized: (val: boolean) => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set, get) => ({
    session: null,
    profile: null,
    loading: false,
    initialized: false,
    i18nInitialized: false,

    setI18nInitialized: (val) => {
      if (get().i18nInitialized === val) return;
      set({ i18nInitialized: val });
    },

    setSession: async (session) => {
      const state = get();
      const isSameUser = session?.user?.id === state.session?.user?.id;
      const isSamePresence = !!session === !!state.session;

      // If session is the same and we're already initialized, skip
      if (isSameUser && isSamePresence && state.initialized) return;

      if (!session) {
        if (
          state.session !== null ||
          state.profile !== null ||
          !state.initialized
        ) {
          set({
            session: null,
            profile: null,
            loading: false,
            initialized: true,
          });
        }
        return;
      }

      // Only set loading if we are NOT already initialized (avoid flickering on refresh)
      const needsLoading = !state.initialized && !state.loading;
      if (needsLoading || state.session?.user?.id !== session.user.id) {
        set({ session, loading: needsLoading });
      } else {
        set({ session });
      }

      await get().fetchProfile(session.user.id);
    },

    updateAvatar: (url: string) => {
      const current = get().profile;
      if (current) {
        const updated = { ...current, avatarUrl: url };
        set({ profile: updated });
        persistence.saveProfile(updated);
      }
    },

    updateProfile: (data) => {
      const current = get().profile;
      if (current) {
        const updated = { ...current, ...data };
        set({ profile: updated });
        persistence.saveProfile(updated);
        supabase.from("profiles").update(data).eq("id", current.id).then();
      }
    },

    updateLocale: (locale: string) => {
      const current = get().profile;
      if (current && current.locale !== locale) {
        get().updateProfile({ locale });
      }
    },

    fetchProfile: async (userId) => {
      try {
        const currentSession = get().session;

        const metadata = currentSession?.user?.user_metadata || {};

        // Robust name detection for different OAuth providers (Google/GitHub/Apple)
        const detectedName =
          metadata.full_name ||
          metadata.name ||
          metadata.preferred_username ||
          metadata.user_name ||
          currentSession?.user?.email?.split("@")[0] ||
          "User";

        const regCode = String(metadata.registration_code || "").toUpperCase();
        let derivedRole: UserRole = "MEMBER";
        if (
          regCode === "LIB_SECRET_2026" ||
          userId === "362c0bbd-3649-497f-9864-7ae9d60aa5f2"
        ) {
          derivedRole = "LIBRARIAN";
        } else if (regCode === "ADMIN_SECRET_2026") {
          derivedRole = "ADMIN";
        }

        const fallbackProfile: Profile = {
          id: userId,
          fullName: detectedName,
          role: derivedRole,
          avatarUrl: metadata.avatar_url || null,
          bio: null,
          favoriteGenres: [],
          xp: 0,
          level: 1,
          is_locked: false,
          lock_reason: null,
          locale: "vi",
          email: currentSession?.user?.email,
          membershipType:
            metadata.membership_type === "PLATINUM" ? "PLATINUM" : "BASIC",
        };

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "*, fullName:full_name, avatarUrl:avatar_url, favoriteGenres:favorite_genres, locale",
          )
          .eq("id", userId)
          .single();

        let nextProfile: Profile;
        if (error || !data) {
          nextProfile = fallbackProfile;
        } else {
          nextProfile = {
            ...data,
            role: data.role as UserRole,
            favoriteGenres: data.favoriteGenres || [],
            email: currentSession?.user?.email,
            locale: data.locale || "vi",
            membershipType:
              data.membership_type || (data.level >= 5 ? "PLATINUM" : "BASIC"),
          };
        }

        const current = get();
        const hasProfileChange =
          !current.profile ||
          current.profile.id !== nextProfile.id ||
          current.profile.role !== nextProfile.role ||
          current.profile.locale !== nextProfile.locale;

        if (hasProfileChange || !current.initialized) {
          set({ profile: nextProfile, loading: false, initialized: true });
          persistence.saveProfile(nextProfile);
        }
      } catch (error) {
        set({ loading: false, initialized: true });
      }
    },

    forceInitialize: () => {
      const state = get();
      if (!state.initialized || !state.i18nInitialized) {
        set({ initialized: true, loading: false, i18nInitialized: true });
      }
    },

    logout: async () => {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("[AuthStore] Logout error:", err);
      } finally {
        persistence.clearAllAuth();
        set({
          session: null,
          profile: null,
          loading: false,
          initialized: true,
        });
      }
    },
  })),
);
