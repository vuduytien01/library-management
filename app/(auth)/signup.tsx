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
import { signInWithOAuthProvider } from "../../src/auth/oauth";

export default function SignupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert(t("common.error", "Lỗi"), t("auth.fill_all", "Vui lòng nhập đầy đủ họ tên, email và mật khẩu"));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            registration_code: registrationCode.trim().toUpperCase(), // The trigger will read this and it MUST be uppercase
          },
        },
      });

      if (error) throw error;
      
      const successMsg = t("auth.signup_success_msg", "Đăng ký thành công! Hãy quay lại trang đăng nhập để tiếp tục.");
      if (Platform.OS === "web") {
        window.alert(successMsg);
        router.push("/(auth)/login");
      } else {
        Alert.alert(t("common.success", "Thành công"), successMsg, [{ text: t("auth.back_to_login", "Quay về Đăng nhập"), onPress: () => router.push("/(auth)/login") }]);
      }
    } catch (error: any) {
      console.error("Lỗi đăng ký:", error.message);
      if (Platform.OS === "web") {
        window.alert(t("auth.signup_failed", "Đăng ký thất bại") + ": " + error.message);
      } else {
        Alert.alert(t("auth.signup_failed", "Đăng ký thất bại"), error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    if (loading) return;

    setLoading(true);
    try {
      await signInWithOAuthProvider(provider);
      const providerLabel = provider === "google" ? "Google" : "GitHub";
      Alert.alert(
        t("common.success", "Thành công"),
        t("auth.oauth_signup_redirect", "Đã mở đăng ký với {{providerLabel}}. Hoàn tất xác thực để tiếp tục.", { providerLabel }),
      );
    } catch (error: any) {
      Alert.alert(t("auth.signup_failed", "Đăng ký thất bại"), error.message);
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
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={{ width: 44, height: 44, backgroundColor: "#151929", borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1E2540", marginBottom: 32 }}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Title */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "700", lineHeight: 34 }}>
            {t("auth.create_account", "Tạo tài khoản mới")}
          </Text>
          <Text style={{ color: "#8B8FA3", fontSize: 15, marginTop: 8, lineHeight: 22 }}>
            {t("auth.signup_sub", "Bắt đầu hành trình đọc sách của bạn")}
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 20 }}>
          {/* Full Name */}
          <View>
            <Text style={{ color: "#8B8FA3", fontSize: 12, fontWeight: "600", letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase" }}>
              {t("profile.full_name", "Họ và tên")}
            </Text>
            <View style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: "#151929", borderRadius: 12,
              borderWidth: 1, borderColor: "#1E2540",
              paddingHorizontal: 16, paddingVertical: 14,
            }}>
              <Ionicons name="person-outline" size={18} color="#5A5F7A" />
              <TextInput
                style={{ flex: 1, marginLeft: 12, color: "#FFFFFF", fontSize: 15 }}
                placeholder="Nguyễn Văn A"
                placeholderTextColor="#3D4260"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* Email */}
          <View>
            <Text style={{ color: "#8B8FA3", fontSize: 12, fontWeight: "600", letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase" }}>
              {t("auth.email", "Email")}
            </Text>
            <View style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: "#151929", borderRadius: 12,
              borderWidth: 1, borderColor: "#1E2540",
              paddingHorizontal: 16, paddingVertical: 14,
            }}>
              <Ionicons name="mail-outline" size={18} color="#5A5F7A" />
              <TextInput
                style={{ flex: 1, marginLeft: 12, color: "#FFFFFF", fontSize: 15 }}
                placeholder="email@example.com"
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
            <Text style={{ color: "#8B8FA3", fontSize: 12, fontWeight: "600", letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase" }}>
              {t("auth.password", "Mật khẩu")}
            </Text>
            <View style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: "#151929", borderRadius: 12,
              borderWidth: 1, borderColor: "#1E2540",
              paddingHorizontal: 16, paddingVertical: 14,
            }}>
              <Ionicons name="lock-closed-outline" size={18} color="#5A5F7A" />
              <TextInput
                style={{ flex: 1, marginLeft: 12, color: "#FFFFFF", fontSize: 15 }}
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

          {/* Registration Code (Optional) */}
          <View>
            <Text style={{ color: "#8B8FA3", fontSize: 12, fontWeight: "600", letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase" }}>
              {t("auth.reg_code_optional", "Mã đăng ký (Tùy chọn yêu cầu quyền)")}
            </Text>
            <View style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: "#151929", borderRadius: 12,
              borderWidth: 1, borderColor: "#1E2540",
              paddingHorizontal: 16, paddingVertical: 14,
            }}>
              <Ionicons name="key-outline" size={18} color="#5A5F7A" />
              <TextInput
                style={{ flex: 1, marginLeft: 12, color: "#FFFFFF", fontSize: 15 }}
                placeholder={t("auth.reg_code_placeholder", "Nhập mã nếu bạn là Quản trị/Thủ thư")}
                placeholderTextColor="#3D4260"
                autoCapitalize="none"
                secureTextEntry
                value={registrationCode}
                onChangeText={setRegistrationCode}
              />
            </View>
          </View>
        </View>

        {/* Signup Button */}
        <TouchableOpacity
          style={{
            marginTop: 32,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: loading ? "#2D5AA0" : "#4F8EF7",
          }}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
            {loading ? t("common.processing", "Đang đăng ký...") : t("auth.register_account", "Đăng ký tài khoản")}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 28 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: "#1E2540" }} />
          <Text style={{ marginHorizontal: 16, color: "#5A5F7A", fontSize: 13 }}>
            {t("auth.or_continue", "Hoặc tiếp tục với")}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#1E2540" }} />
        </View>

        {/* Social Login Buttons */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}>
          <TouchableOpacity
            testID="oauth-google-signup"
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
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="oauth-github-signup"
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
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Github</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={{ marginTop: "auto", paddingTop: 32, flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#5A5F7A", fontSize: 14 }}>{t("auth.already_have_account", "Đã có tài khoản? ")}</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={{ color: "#4F8EF7", fontSize: 14, fontWeight: "700" }}>{t("auth.login_cta", "Đăng nhập")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
