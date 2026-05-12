import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppBootstrap } from "../src/services/bootstrap/useAppBootstrap";
import { useAccountStatus } from "../src/hooks/useAccountStatus";
import { useAuthStore } from "../src/store/useAuthStore";
import "../src/i18n";
import React from "react";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isReady } = useAppBootstrap();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const segments = useSegments();
  const router = useRouter();
  
  // Security monitor
  useAccountStatus();
  
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === "(auth)";


    if (!session && !inAuthGroup) {
      // Not logged in and not in auth group -> go to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup && profile) {
      // Logged in but in auth group -> go to dashboard
      if (profile.role === "ADMIN") {
        router.replace("/(admin)");
      } else if (profile.role === "LIBRARIAN") {
        router.replace("/(librarian)");
      } else {
        router.replace("/(member)");
      }
    }

    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady, session, profile, segments]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0F1A" }}>
      <View style={{ flex: 1, opacity: isReady ? 1 : 0 }}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="(auth)" options={{ animation: "none" }} />
          <Stack.Screen name="(admin)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(librarian)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(member)" options={{ gestureEnabled: false }} />
        </Stack>
      </View>

      {!isReady && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999, backgroundColor: "#0B0F1A" }]} pointerEvents="none">
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
    <QueryClientProvider client={queryClient}>
      <RootLayoutContent />
    </QueryClientProvider>
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
