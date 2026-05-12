import { Ionicons } from "@expo/vector-icons";
import { useAccountStatus } from "../../src/hooks/useAccountStatus";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { View, Platform } from "react-native";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import ErrorBoundary from "../../src/components/ErrorBoundary";
import { notificationService } from "../../src/core/notifications";
import { useAuthStore } from "../../src/store/useAuthStore";

import { useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTabBarStore } from "../../src/store/useTabBarStore";

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
        {Platform.OS === 'web' && (
          <style>{`
            .member-taskbar-container {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
              transform: translateY(calc(100% - 14px));
              opacity: 0.4;
              z-index: 100;
            }
            .member-taskbar-container:hover {
              transform: translateY(0);
              opacity: 1;
            }
          `}</style>
        )}
        <Tabs
          tabBar={(props) => (
            <View className={Platform.OS === 'web' ? "member-taskbar-container" : ""}>
              <BottomTabBar {...props} />
            </View>
          )}
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              position: "absolute",
              bottom: 8,
              left: 12,
              right: 12,
              backgroundColor: "#0B0F1A",
              borderColor: "transparent",
              borderWidth: 0,
              borderRadius: 16,
              overflow: "hidden",
              height: isMainScreen ? 65 : 65.1,
              paddingBottom: 10,
              transform: Platform.OS === 'web' ? [] : (isMainScreen || isTabBarVisible ? [{ translateY: 0 }] : [{ translateY: 65 }]),
              opacity: Platform.OS === 'web' ? 1 : (isMainScreen || isTabBarVisible ? 1 : 0),
            },
            tabBarItemStyle: {
              borderRightWidth: 1,
              borderRightColor: "rgba(255, 255, 255, 0.08)",
              height: "100%",
            },
            tabBarActiveTintColor: "#4F8EF7",
            tabBarInactiveTintColor: "#5A5F7A",
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "600",
            },
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
            name="audiobooks"
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
              title: t("tabs.community"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="people" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
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
          <Tabs.Screen name="audiobooks/index" options={{ href: null }} />
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
      </View>
    </ErrorBoundary>
  );
}
