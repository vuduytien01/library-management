import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "../src/api/supabase";
import {
  syncCurrentSessionAndGetHomeRoute,
  syncSessionAndGetHomeRoute,
} from "../src/auth/roleRedirect";

type CallbackParams = {
  code?: string | string[];
  error?: string | string[];
  error_description?: string | string[];
  access_token?: string | string[];
  refresh_token?: string | string[];
};

const firstParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const webHashParam = (name: string) => {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return undefined;

  return new URLSearchParams(hash).get(name) ?? undefined;
};

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CallbackParams>();
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập...");

  useEffect(() => {
    let isActive = true;
    let loginRedirectTimer: ReturnType<typeof setTimeout> | null = null;

    async function completeOAuthRedirect() {
      try {
        const code = firstParam(params.code) ?? webHashParam("code");
        const authError = firstParam(params.error) ?? webHashParam("error");
        const authErrorDescription =
          firstParam(params.error_description) ??
          webHashParam("error_description");
        const accessToken =
          firstParam(params.access_token) ?? webHashParam("access_token");
        const refreshToken =
          firstParam(params.refresh_token) ?? webHashParam("refresh_token");

        if (authError) {
          throw new Error(authErrorDescription || authError);
        }

        let targetRoute = null;

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            targetRoute = await syncCurrentSessionAndGetHomeRoute();
            if (!targetRoute) throw error;
          } else if (data.session) {
            targetRoute = await syncSessionAndGetHomeRoute(data.session);
          }
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
          if (data.session) {
            targetRoute = await syncSessionAndGetHomeRoute(data.session);
          }
        }

        if (!targetRoute) {
          targetRoute = await syncCurrentSessionAndGetHomeRoute();
        }

        if (!targetRoute) {
          throw new Error("Không tìm thấy phiên đăng nhập OAuth");
        }

        if (isActive) {
          router.replace(targetRoute);
        }
      } catch (error: any) {
        console.error("[AuthCallback] OAuth redirect failed:", error?.message);
        if (isActive) {
          setMessage(error?.message || "Đăng nhập OAuth thất bại");
          loginRedirectTimer = setTimeout(() => {
            if (isActive) {
              router.replace("/(auth)/login");
            }
          }, 1200);
        }
      }
    }

    completeOAuthRedirect();

    return () => {
      isActive = false;
      if (loginRedirectTimer) {
        clearTimeout(loginRedirectTimer);
      }
    };
  }, [
    params.access_token,
    params.code,
    params.error,
    params.error_description,
    params.refresh_token,
    router,
  ]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4F8EF7" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0F1A",
    padding: 24,
  },
  message: {
    marginTop: 16,
    color: "#8B8FA3",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
