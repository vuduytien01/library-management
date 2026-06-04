import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ErrorBoundary from "../src/components/ErrorBoundary";
import { RouteBackButton } from "../src/components/RouteBackButton";
import { UndoNotification } from "../src/components/UndoNotification";
import {
  getHomeRouteForProfile,
  getRouteGroupForProfile,
} from "../src/auth/roleRedirect";
import { useAccountStatus } from "../src/hooks/useAccountStatus";
import "../src/i18n";
import { useAppBootstrap } from "../src/services/bootstrap/useAppBootstrap";
import { useAuthStore } from "../src/store/useAuthStore";
import { useTabBarStore } from "../src/store/useTabBarStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
});
const ROLE_ROUTE_GROUPS = new Set(["(admin)", "(librarian)", "(member)"]);
const AMBIGUOUS_ROLE_PATHS = new Set([
  "audiobooks",
  "search",
  "profile",
  "settings",
  "notifications",
  "history",
  "community",
  "analytics",
  "downloads",
  "book",
]);

const routeForProfileGroup = (
  group: "(admin)" | "(librarian)" | "(member)",
  segments: string[],
  options: { grouped: boolean } = { grouped: true },
) => {
  const leafSegments = segments
    .slice(options.grouped ? 1 : 0)
    .filter((segment) => segment && segment !== "index");
  return leafSegments.length
    ? (`/${group}/${leafSegments.join("/")}` as const)
    : (`/${group}` as const);
};

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutContent() {
  const { isReady } = useAppBootstrap();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const segments = useSegments();
  const router = useRouter();
  const { i18n } = useTranslation();
  const lastY = useRef(0);
  const injectedTestProfile =
    process.env.NODE_ENV !== "production" &&
    Platform.OS === "web" &&
    typeof window !== "undefined"
      ? (window as any).__TEST_PROFILE
      : null;
  const effectiveSession = session || (injectedTestProfile ? true : null);
  const hasBootstrappedProfile = !effectiveSession || !!profile;
  const canShowRoutes = isReady && hasBootstrappedProfile;
  const replaceRoleRoute = (route: string) => {
    if (Platform.OS === "web" && route.startsWith("/(")) {
      window.location.replace(route);
      return;
    }
    router.replace(route as any);
  };

  // Security monitor
  useAccountStatus(true);

  // Sync i18n with profile locale
  useEffect(() => {
    if (profile?.locale && profile.locale !== i18n.language) {
      void i18n.changeLanguage(profile.locale).catch(() => {});
    }
  }, [profile?.locale]);

  // Web: scroll-based tabbar auto-show
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onScroll = () => {
      useTabBarStore.getState().triggerVisible();
    };
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", onScroll, {
        capture: true,
      } as any);
    };
  }, []);

  // Navigation guard
  useEffect(() => {
    if (!isReady) return;

    const rootSegment = segments[0];
    const inAuthGroup = rootSegment === "(auth)";
    const inAuthCallback = rootSegment === "auth-callback";

    if (!effectiveSession) {
      // Not logged in -> force to auth group if not already there
      if (!inAuthGroup && !inAuthCallback) {
        router.replace("/(auth)/login");
      }
    } else if (!profile) {
      // Session exists but the profile is still loading. Do not default to
      // member; staff users would briefly mount the wrong route group on F5.
      if (inAuthCallback) {
        console.log("[RootLayout] Waiting for OAuth callback to sync profile");
      }
    } else if (inAuthGroup || inAuthCallback) {
      console.log(
        "[RootLayout] Redirecting to dashboard based on profile:",
        profile.role,
        profile.is_super_admin ? "super-admin" : "",
      );
      router.replace(getHomeRouteForProfile(profile));
    } else if (ROLE_ROUTE_GROUPS.has(String(rootSegment))) {
      const expectedGroup = getRouteGroupForProfile(profile);
      if (rootSegment !== expectedGroup) {
        replaceRoleRoute(routeForProfileGroup(expectedGroup, segments));
      }
    } else if (rootSegment && AMBIGUOUS_ROLE_PATHS.has(String(rootSegment))) {
      const expectedGroup = getRouteGroupForProfile(profile);
      replaceRoleRoute(
        routeForProfileGroup(expectedGroup, segments, {
          grouped: false,
        }),
      );
    }

    if (canShowRoutes) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [
    isReady,
    canShowRoutes,
    effectiveSession,
    profile?.role,
    profile?.is_super_admin,
    segments,
  ]);

  return (
    <View
      // Native: touch-based tabbar auto-show
      onTouchStart={(e) => {
        if (Platform.OS !== "web") {
          lastY.current = e.nativeEvent.pageY;
        }
      }}
      onTouchMove={(e) => {
        if (Platform.OS !== "web") {
          const diff = Math.abs(lastY.current - e.nativeEvent.pageY);
          if (diff > 5) {
            useTabBarStore.getState().triggerVisible();
          }
        }
      }}
      style={[styles.appRoot, Platform.OS === "web" && styles.webAppRoot]}
    >
      {/* Web: Global taskbar autohide CSS for member/librarian 65.1px bars */}
      {Platform.OS === "web" && (
        <style>{`
          ::-webkit-scrollbar {
            display: none;
            width: 0px;
            height: 0px;
          }
          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
        `}</style>
      )}

      <View
        style={[
          styles.routeHost,
          Platform.OS === "web" && styles.webRouteHost,
          { opacity: canShowRoutes ? 1 : 0 },
        ]}
      >
        <Stack
          key={i18n.language}
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 300,
            contentStyle: { backgroundColor: "#0B0F1A" },
          }}
        >
          <Stack.Screen name="(auth)" options={{ animation: "none" }} />
          <Stack.Screen name="auth-callback" options={{ animation: "none" }} />
          <Stack.Screen name="(admin)" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="(librarian)"
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="(member)" options={{ gestureEnabled: false }} />
        </Stack>
      </View>

      {/* Global Undo - previous compact gradient design */}
      <UndoNotification />
      <RouteBackButton />

      {!canShowRoutes && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 999, backgroundColor: "#0B0F1A" },
          ]}
          pointerEvents="none"
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3A75F2" />
            <Text style={styles.loadingText}>Loading BiblioTech...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RootLayoutContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  webAppRoot: {
    width: "100%",
    minHeight: "100%" as any,
    alignSelf: "stretch",
  },
  routeHost: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  webRouteHost: {
    width: "100%",
    minHeight: "100%" as any,
    alignSelf: "stretch",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
  },
  loadingText: {
    marginTop: 16,
    color: "#8B8FA3",
    fontSize: 14,
    fontWeight: "500",
  },
});
