import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { supabase } from "../api/supabase";
import { useAuthStore } from "../store/useAuthStore";

export type OAuthProvider = "google" | "github";

/**
 * Gọi hàm này ở đầu màn hình login để hoàn tất phiên WebBrowser trên Web/Android.
 * Phải được gọi BÊN TRONG một React component.
 */
export function completeAuthSession() {
  WebBrowser.maybeCompleteAuthSession();
}

const getOAuthRedirectUrl = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth-callback`;
  }

  return Linking.createURL("auth-callback");
};

export async function signInWithOAuthProvider(
  provider: OAuthProvider,
): Promise<void> {
  // Clear any existing partial state before starting
  await supabase.auth.signOut({ scope: "local" });

  if (Platform.OS === "web") {
    const redirectTo = getOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw new Error(error.message);
    if (!data?.url)
      throw new Error("Không thể khởi tạo liên kết xác thực OAuth");

    console.log("[OAuth] Redirecting web browser:", {
      provider,
      redirectTo,
    });
    window.location.assign(data.url);
    return;
  }

  // ---- NATIVE (Expo Go / Standalone) ----
  // Tự động tạo URL phản hồi phù hợp với môi trường (Expo Go hoặc App thật)
  const redirectTo = getOAuthRedirectUrl();
  console.log("[OAuth] Using Redirect URL:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error("Không thể khởi tạo liên kết xác thực OAuth");

  // Open the browser and wait for the result
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("Bạn đã hủy quá trình xác thực OAuth");
  }

  if (result.type === "success" && result.url) {
    console.log("[OAuth] Browser returned with URL:", result.url);
    await handleNativeOAuthCallback(result.url);
  }
}

/**
 * Enhanced callback handler for Native environments.
 * Extracts tokens/codes even from non-standard Expo Go URLs.
 */
async function handleNativeOAuthCallback(callbackUrl: string): Promise<void> {
  try {
    // 1. Normalize the URL (Handle exp://.../--/ or libraryapp://)
    // We use regex to find the fragments because URL parser can fail on non-standard schemes
    const getParam = (name: string) => {
      const regex = new RegExp(`[#?&]${name}=([^&]*)`);
      const match = callbackUrl.match(regex);
      return match ? decodeURIComponent(match[1]) : null;
    };

    const code = getParam("code");
    const accessToken = getParam("access_token");
    const refreshToken = getParam("refresh_token");

    console.log("[OAuth] Detected in URL:", {
      hasCode: !!code,
      hasAccessToken: !!accessToken,
    });

    if (code) {
      // PKCE Flow
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[OAuth] Exchange error:", error.message);
        throw error;
      }

      if (data.session) {
        console.log(
          "[OAuth] Session established successfully, syncing store...",
        );

        // Explicitly update our store to trigger navigation immediately
        const { setSession } = useAuthStore.getState();
        await setSession(data.session);

        console.log("[OAuth] Store synced. Navigation should trigger.");
      }
    } else if (accessToken && refreshToken) {
      // Implicit Flow fallback
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    } else {
      // Fallback: If nothing in URL, maybe Supabase already picked it up?
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error("Không tìm thấy thông tin xác thực trong phản hồi");
      }
    }

    console.log("[OAuth] Session established successfully");
  } catch (err: any) {
    console.error("[OAuth] Callback Processing Error:", err.message);
    throw err;
  }
}
