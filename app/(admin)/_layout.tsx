import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { BottomTabBar } from "@react-navigation/bottom-tabs";

import { useTranslation } from "react-i18next";

export default function AdminLayout() {
  const { t } = useTranslation();

  return (
    <>
      {Platform.OS === 'web' && (
        <style>{`
          .admin-taskbar-container {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
            transform: translateY(calc(100% - 14px));
            opacity: 0.4;
            z-index: 100;
          }
          .admin-taskbar-container:hover {
            transform: translateY(0);
            opacity: 1;
          }
        `}</style>
      )}
      <Tabs
        tabBar={(props) => (
          <View className={Platform.OS === 'web' ? "admin-taskbar-container" : ""}>
            <BottomTabBar {...props} />
          </View>
        )}
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarActiveTintColor: "#3A75F2",
          tabBarInactiveTintColor: "#6B7280",
          tabBarBackground: () => (
            Platform.OS === 'ios' ? (
              <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17, 24, 39, 0.95)' }]} />
            )
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.dashboard"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="logistics"
          options={{
            title: t("tabs.logistics"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="truck-delivery" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: t("tabs.inventory"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="book-open-variant" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="system"
          options={{
            title: t("tabs.system"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="server" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: t("tabs.reports"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-bar" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="config"
          options={{
            title: t("tabs.config"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="audit"
          options={{
            title: t("tabs.audit"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-list-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="security-logs"
          options={{
            title: t("tabs.security_logs"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-lock-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderTopWidth: 0,
    elevation: 0,
    height: Platform.OS === 'ios' ? 88 : 72,
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    ...Platform.select({
      web: {
        backgroundColor: '#111827',
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        height: 72,
      }
    })
  },
  tabItem: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
});
