import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/api/supabase";
import {
  completeAuthSession,
  signInWithOAuthProvider,
} from "../../src/auth/oauth";
import {
  getHomeRouteForProfile,
  syncCurrentSessionAndGetHomeRoute,
} from "../../src/auth/roleRedirect";
import { useAuthStore } from "../../src/store/useAuthStore";

export default function LoginScreen() {
  // Phải gọi trong component để WebBrowser xử lý đúng deep-link trả về
  completeAuthSession();

  const router = useRouter();
  const { t } = useTranslation();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-redirect if already logged in
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);

  React.useEffect(() => {
    if (session && profile) {
      router.replace(getHomeRouteForProfile(profile));
    }
  }, [session, profile, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        t("common.error", "Lỗi"),
        t("auth.wrong_creds", "Vui lòng nhập đầy đủ email và mật khẩu"),
      );
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (data.session) {
        await setSession(data.session);
        if (Platform.OS === "web") {
          // React Native Expo Web handles redirection smoothly, but we can log success or alert
          console.log("Success! Redirecting...");
        } else {
          Alert.alert(
            t("common.success", "Thành công"),
            t(
              "auth.welcome_back",
              "Đăng nhập thành công. Đang chuyển hướng...",
            ),
          );
        }
      }
    } catch (error: any) {
      console.error("Login error:", error.message);
      if (Platform.OS === "web") {
        window.alert(t("common.error", "Lỗi") + ": " + error.message);
      } else {
        Alert.alert(t("common.error", "Lỗi"), error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    if (loading) return;

    setLoading(true);
    try {
      console.log(`[Login] Starting OAuth flow for ${provider}...`);
      await signInWithOAuthProvider(provider);

      // Once the browser closes, wait a tiny bit for Supabase to sync
      // and then check for session if onAuthStateChange hasn't fired yet
      if (Platform.OS !== "web") {
        const targetRoute = await syncCurrentSessionAndGetHomeRoute();
        if (targetRoute) {
          console.log("[Login] OAuth Session detected manually");
          router.replace(targetRoute);
        }
      }
    } catch (error: any) {
      console.error("[Login] OAuth Error:", error.message);
      if (!error.message?.includes("hủy")) {
        Alert.alert(t("common.error"), error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0B0F1A" }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* BiblioTech Branding */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 40,
            marginTop: 16,
          }}
        >
          <Text
            style={{
              color: "#4F8EF7",
              fontSize: 26,
              fontWeight: "800",
              fontStyle: "italic",
              letterSpacing: -0.5,
            }}
          >
            BiblioTech
          </Text>
          <View
            style={{
              marginLeft: 8,
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: "#4F8EF7",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#4F8EF7", fontSize: 11, fontWeight: "700" }}>
              i
            </Text>
          </View>
        </View>

        {/* Title */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 28,
              fontWeight: "700",
              lineHeight: 34,
            }}
          >
            {t("auth.login", "Đăng nhập")}
          </Text>
          <Text
            style={{
              color: "#8B8FA3",
              fontSize: 15,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            {t("auth.welcome_back", "Chào mừng bạn trở lại hệ thống thư viện")}
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 20 }}>
          {/* Email */}
          <View>
            <Text
              style={{
                color: "#8B8FA3",
                fontSize: 12,
                fontWeight: "600",
                letterSpacing: 1.2,
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              {t("auth.email", "Email")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#151929",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1E2540",
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Ionicons name="mail-outline" size={18} color="#5A5F7A" />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 12,
                  color: "#FFFFFF",
                  fontSize: 15,
                }}
                placeholder="email@bv-du.com"
                placeholderTextColor="#3D4260"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              {email.includes("@") && (
                <Ionicons name="checkmark-circle" size={18} color="#4F8EF7" />
              )}
            </View>
          </View>

          {/* Password */}
          <View>
            <Text
              style={{
                color: "#8B8FA3",
                fontSize: 12,
                fontWeight: "600",
                letterSpacing: 1.2,
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              {t("auth.password", "Mật khẩu")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#151929",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1E2540",
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#5A5F7A" />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 12,
                  color: "#FFFFFF",
                  fontSize: 15,
                }}
                placeholder="••••••••"
                placeholderTextColor="#3D4260"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#5A5F7A"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Forgot Password */}
        <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 12 }}>
          <Text style={{ color: "#4F8EF7", fontSize: 13, fontWeight: "500" }}>
            {t("auth.forgot_password", "Quên mật khẩu?")}
          </Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          style={{
            marginTop: 28,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: loading ? "#2D5AA0" : "#4F8EF7",
          }}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
            {loading
              ? t("common.loading", "Đang xử lý...")
              : t("auth.login", "Đăng nhập")}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 28,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: "#1E2540" }} />
          <Text
            style={{ marginHorizontal: 16, color: "#5A5F7A", fontSize: 13 }}
          >
            {t("auth.or_login_with", "Hoặc đăng nhập với")}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#1E2540" }} />
        </View>

        {/* Social Login Buttons — Pill shaped with text */}
        <View
          style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}
        >
          <TouchableOpacity
            testID="oauth-google-login"
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#151929",
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "#1E2540",
              paddingVertical: 14,
              gap: 8,
            }}
            onPress={() => handleOAuth("google")}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
              Google
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="oauth-github-login"
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#151929",
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "#1E2540",
              paddingVertical: 14,
              gap: 8,
            }}
            onPress={() => handleOAuth("github")}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-github" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
              Github
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View
          style={{
            marginTop: "auto",
            paddingTop: 32,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#5A5F7A", fontSize: 14 }}>
            {t("auth.no_account", "Chưa có tài khoản?")}{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
            <Text style={{ color: "#4F8EF7", fontSize: 14, fontWeight: "700" }}>
              {t("auth.register_now", "Đăng ký ngay")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
