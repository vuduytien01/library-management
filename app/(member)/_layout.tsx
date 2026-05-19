import { Ionicons } from "@expo/vector-icons";
import { useAccountStatus } from "../../src/hooks/useAccountStatus";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { View, Platform } from "react-native";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import ErrorBoundary from "../../src/components/ErrorBoundary";
import { notificationService } from "../../src/core/notifications";
import { BiblioAI } from "../../src/features/ai/BiblioAI";
import { useAuthStore } from "../../src/store/useAuthStore";

import { useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTabBarStore } from "../../src/store/useTabBarStore";
import { PremiumTabBar } from "../../src/components/PremiumTabBar";

export default function MemberLayout() {
  const session = useAuthStore((state) => state.session);
  const router = useRouter();
  const { t } = useTranslation();

  const segments = useSegments();
  const isTabBarVisible = useTabBarStore((state) => state.isVisible);

  const isMainScreen =
    segments.length === 1 ||
    String(segments[segments.length - 1]) === "index" ||
    (segments.length === 2 && String(segments[1]) === "");

  useEffect(() => {
    if (session?.user?.id) {
      // 1. Register for push notifications
      notificationService.registerForPushNotificationsAsync().then((token) => {
        if (token) {
          notificationService.savePushToken(session.user.id, token);
        }
      });

      // 2. Setup listeners
      const cleanup = notificationService.setupListeners(
        (notification) => {
          // Handled by Expo when app is in foreground
          console.log("Notification received:", notification);
        },
        (response) => {
          // Handle interaction (tap on notification)
          const data = response.notification.request.content.data;
          if (data?.url) {
            router.push(data.url as any);
          }
        },
      );

      return cleanup;
    }
  }, [session?.user?.id]);

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <Tabs
          backBehavior="history"
          tabBar={(props) => (
            <View>
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
              title: t("tabs.home"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="search"
            options={{
              title: t("tabs.search"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="search" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="audiobooks/index"
            options={{
              title: t("tabs.audiobooks"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="headset" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="community"
            options={{
              href: null,
              title: t("tabs.community"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="people" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
              href: null,
              title: t("tabs.history"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="time" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t("tabs.profile"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person" color={color} size={size} />
              ),
            }}
          />

          {/* Hidden screens from Tab Bar */}
          <Tabs.Screen name="audiobooks/[id]" options={{ href: null }} />
          <Tabs.Screen name="achievements" options={{ href: null }} />
          <Tabs.Screen name="ai-chat" options={{ href: null }} />
          <Tabs.Screen name="analytics" options={{ href: null }} />
          <Tabs.Screen name="chat" options={{ href: null }} />
          <Tabs.Screen name="downloads" options={{ href: null }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
          <Tabs.Screen name="book/[isbn]" options={{ href: null }} />
          <Tabs.Screen name="book/index" options={{ href: null }} />
          <Tabs.Screen name="club/index" options={{ href: null }} />
          <Tabs.Screen name="club/[id]" options={{ href: null }} />
        </Tabs>
        <BiblioAI />
      </View>
    </ErrorBoundary>
  );
}
