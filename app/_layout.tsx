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
import { GlobalUndoButton } from "../src/components/GlobalUndoButton";
import { UndoSnackbar } from "../src/components/UndoSnackbar";
import { useAccountStatus } from "../src/hooks/useAccountStatus";
import "../src/i18n";
import { useAppBootstrap } from "../src/services/bootstrap/useAppBootstrap";
import { useAuthStore } from "../src/store/useAuthStore";
import { useTabBarStore } from "../src/store/useTabBarStore";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isReady } = useAppBootstrap();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const segments = useSegments();
  const router = useRouter();
  const { i18n } = useTranslation();
  const lastY = useRef(0);

  // Security monitor
  useAccountStatus(true);

  // Sync i18n with profile locale
  useEffect(() => {
    if (profile?.locale && profile.locale !== i18n.language) {
      i18n.changeLanguage(profile.locale);
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

    const inAuthGroup = segments[0] === "(auth)";

    if (!session) {
      // Not logged in -> force to auth group if not already there
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // Logged in!
      if (inAuthGroup) {
        // If we have a profile, go to the right dashboard
        if (profile) {
          console.log("[RootLayout] Redirecting to dashboard based on role:", profile.role);
          if (profile.role === "ADMIN") {
            router.replace("/(admin)");
          } else if (profile.role === "LIBRARIAN") {
            router.replace("/(librarian)");
          } else {
            router.replace("/(member)");
          }
        } else {
          // No profile yet? Default to member to avoid hanging, or wait for loading
          // But since we are in (auth), let's push to member as safe default
          console.log("[RootLayout] Session exists but profile missing, defaulting to (member)");
          router.replace("/(member)");
        }
      }
    }

    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady, session, profile?.role, segments[0]]);

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
      style={{ flex: 1, backgroundColor: "#0B0F1A" }}
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

      <View style={{ flex: 1, opacity: isReady ? 1 : 0 }}>
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
          <Stack.Screen name="(admin)" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="(librarian)"
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="(member)" options={{ gestureEnabled: false }} />
        </Stack>
      </View>

      {/* Global Undo Snackbar - renders for all roles */}
      <UndoSnackbar />
      <GlobalUndoButton />

      {!isReady && (
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
