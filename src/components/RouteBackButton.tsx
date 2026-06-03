import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import React from "react";
import { Platform, StyleSheet, TouchableOpacity } from "react-native";
import Animated, { FadeInLeft, FadeOutLeft } from "react-native-reanimated";

const ROUTES_WITH_OWN_BACK = new Set([
  "search",
  "profile",
  "settings",
  "notifications",
  "downloads",
  "history",
  "achievements",
  "chat",
  "ai-chat",
  "cleanup",
  "logistics",
  "sources",
  "broadcast",
  "demand-prediction",
]);

const MEMBER_ROUTES_WITH_OWN_BACK = [
  "audiobooks",
  "audiobooks/",
  "book/",
  "club/",
  "human-library",
  "human-library/",
];

const routeKeyFromSegments = (segments: string[]) =>
  segments
    .slice(1)
    .filter((segment) => segment && segment !== "index")
    .join("/");

const routeHasOwnBack = (group: string | undefined, routeKey: string) => {
  if (ROUTES_WITH_OWN_BACK.has(routeKey)) {
    return true;
  }

  if (group !== "(member)") {
    return false;
  }

  return MEMBER_ROUTES_WITH_OWN_BACK.some((route) =>
    route.endsWith("/") ? routeKey.startsWith(route) : routeKey === route,
  );
};

export const RouteBackButton = () => {
  const router = useRouter();
  const segments = useSegments() as string[];
  const group = segments[0];
  const routeKey = routeKeyFromSegments(segments);

  const isRoleGroup =
    group === "(admin)" || group === "(librarian)" || group === "(member)";
  const isDashboard = isRoleGroup && !routeKey;
  const hasOwnBack = routeHasOwnBack(group, routeKey);

  if (!isRoleGroup || isDashboard || hasOwnBack) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInLeft.duration(160)}
      exiting={FadeOutLeft.duration(120)}
      style={styles.container}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back"
        activeOpacity={0.8}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          }
        }}
        style={styles.button}
      >
        <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 48 : 18,
    left: 14,
    zIndex: 10000,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23, 27, 43, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});
