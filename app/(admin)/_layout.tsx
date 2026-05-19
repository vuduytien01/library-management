import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import ErrorBoundary from "../../src/components/ErrorBoundary";
import { BiblioAI } from "../../src/features/ai/BiblioAI";

import { useTranslation } from "react-i18next";
import { useTabBarStore } from "../../src/store/useTabBarStore";
import { useSegments } from "expo-router";
import { PremiumTabBar } from "../../src/components/PremiumTabBar";

export default function AdminLayout() {
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
          name="logistics"
          options={{
            title: t("tabs.logistics"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="truck-delivery"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: t("tabs.inventory"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="book-open-variant"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="system"
          options={{
            title: t("tabs.system"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="server" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: t("tabs.reports"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="chart-bar"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="config"
          options={{
            title: t("tabs.config"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cog" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="audit"
          options={{
            title: t("tabs.audit"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="security-logs"
          options={{
            title: t("tabs.security_logs"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="shield-lock-outline"
                size={size}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
      <BiblioAI />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({});
