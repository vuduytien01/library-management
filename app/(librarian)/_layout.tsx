import { Ionicons } from "@expo/vector-icons";
import { useAccountStatus } from "../../src/hooks/useAccountStatus";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useAuthStore } from "../../src/store/useAuthStore";
import ErrorBoundary from "../../src/components/ErrorBoundary";
import { useTranslation } from "react-i18next";
import { useTabBarStore } from "../../src/store/useTabBarStore";

import { useSegments } from "expo-router";

export default function LibrarianLayout() {
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslation();


  const segments = useSegments();
  const isTabBarVisible = useTabBarStore((state) => state.isVisible);

  const isMainScreen = segments.length === 1 || String(segments[segments.length - 1]) === 'index' || (segments.length === 2 && String(segments[1]) === '');

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              position: 'absolute',
              bottom: 8,
              left: 12,
              right: 12,
              backgroundColor: '#0B0F1A',
              borderColor: 'transparent',
              borderWidth: 0,
              borderRadius: 16,
              overflow: 'hidden',
              height: isMainScreen ? 65 : 65.1,
              paddingBottom: 10,
              transform: isMainScreen || isTabBarVisible ? [{ translateY: 0 }] : [{ translateY: 65 }],
              opacity: isMainScreen || isTabBarVisible ? 1 : 0,
            },
            tabBarItemStyle: {
              borderRightWidth: 0,
              borderRightColor: 'transparent',
              height: '100%',
            },
            tabBarActiveTintColor: '#4F8EF7',
            tabBarInactiveTintColor: '#5A5F7A',
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t('tabs.home'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="borrows"
            options={{
              title: t('tabs.borrows'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="clipboard" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="books"
            options={{
              title: t('tabs.inventory'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="book" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="reports"
            options={{
              title: t('tabs.reports'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="stats-chart" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: t('tabs.insights'),
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
      </View>
    </ErrorBoundary>
  );
}
