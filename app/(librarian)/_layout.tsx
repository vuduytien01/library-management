import { Ionicons } from "@expo/vector-icons";
import { useAccountStatus } from "../../src/hooks/useAccountStatus";
import { Redirect, Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "../../src/store/useAuthStore";
import ErrorBoundary from "../../src/components/ErrorBoundary";
import { BiblioAI } from "../../src/features/ai/BiblioAI";
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
        {Platform.OS === "web" && (
          <style>{`
            .librarian-taskbar-container {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              transition: opacity 0.4s ease;
              opacity: 0.4;
              z-index: 100;
            }
            .librarian-taskbar-container:hover {
              opacity: 1;
            }
          `}</style>
        )}
        <Tabs
          tabBar={(props) => (
            <View
              className={
                Platform.OS === "web" ? "librarian-taskbar-container" : ""
              }
              style={{
                opacity:
                  Platform.OS === "web"
                    ? 1
                    : isMainScreen || isTabBarVisible
                      ? 1
                      : 0.4,
              }}
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
              title: t("tabs.reports"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="stats-chart" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
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
        <BiblioAI />
      </View>
    </ErrorBoundary>
  );
}
