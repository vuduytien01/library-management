import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccountStatus } from "../../src/hooks/useAccountStatus";
import { Redirect, Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useAuthStore } from "../../src/store/useAuthStore";
import ErrorBoundary from "../../src/components/ErrorBoundary";
import { DeferredBiblioAI } from "../../src/features/ai/DeferredBiblioAI";
import { useTranslation } from "react-i18next";
import { useTabBarStore } from "../../src/store/useTabBarStore";
import { PremiumTabBar } from "../../src/components/PremiumTabBar";

import { useSegments } from "expo-router";

export default function LibrarianLayout() {
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslation();
  const segments = useSegments();
  const isTabBarVisible = useTabBarStore((state) => state.isVisible);

  const isMainScreen =
    segments.length === 1 ||
    String(segments[segments.length - 1]) === "index" ||
    (segments.length === 2 && String(segments[1]) === "");

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={(props) => (
            <View
              pointerEvents="box-none"
              style={[
                styles.tabBarHost,
                { opacity: isMainScreen || isTabBarVisible ? 1 : 0.4 },
              ]}
            >
              <PremiumTabBar {...props} />
            </View>
          )}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t("tabs.dashboard"),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name="view-dashboard"
                  size={size}
                  color={color}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="search"
            options={{
              title: t("common.search"),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name="magnify"
                  size={size}
                  color={color}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="borrows"
            options={{
              title: t("tabs.borrows"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="clipboard" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="books"
            options={{
              title: t("tabs.inventory"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="book" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="reports"
            options={{
              href: null,
              title: t("tabs.reports"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="stats-chart" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              href: null,
              title: t("tabs.insights"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="sparkles" color={color} size={size} />
              ),
            }}
          />

          {/* Hidden screens from Tab Bar */}
          <Tabs.Screen name="broadcast" options={{ href: null }} />
          <Tabs.Screen name="cleanup" options={{ href: null }} />
          <Tabs.Screen name="demand-prediction" options={{ href: null }} />
          <Tabs.Screen name="logistics" options={{ href: null }} />
          <Tabs.Screen name="sources" options={{ href: null }} />
          <Tabs.Screen name="audiobooks" options={{ href: null }} />
        </Tabs>
        <DeferredBiblioAI />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tabBarHost: {
    backgroundColor: "transparent",
  },
});
