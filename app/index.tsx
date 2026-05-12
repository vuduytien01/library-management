import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuthStore } from "../src/store/useAuthStore";

export default function Index() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const initialized = useAuthStore((state) => state.initialized);

  useEffect(() => {
    if (!initialized) return;

    const timeout = setTimeout(() => {
      if (!session) {
        router.replace("/(auth)/login");
      } else if (profile) {
        // Direct based on role
        if (profile.role === "ADMIN") {
          router.replace("/(admin)");
        } else if (profile.role === "LIBRARIAN") {
          router.replace("/(librarian)");
        } else {
          router.replace("/(member)");
        }
      }
    }, 500); // Small delay for premium feel

    return () => clearTimeout(timeout);
  }, [session, profile, initialized]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0B0F1A", // Match the new premium theme
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color="#4F8EF7" />
      <Text
        style={{
          color: "#4F8EF7",
          fontSize: 20,
          fontWeight: "800",
          marginTop: 24,
          letterSpacing: 4,
        }}
      >
        THE LIBRARY
      </Text>
      <Text style={{ color: "#5A5F7A", marginTop: 10, fontSize: 12 }}>
        v2.0 Premium Edition
      </Text>
    </View>
  );
}
