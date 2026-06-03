import React from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ErrorBoundary from "../../src/components/ErrorBoundary";
import { DeferredBiblioAI } from "../../src/features/ai/DeferredBiblioAI";

import { useTranslation } from "react-i18next";
import { PremiumTabBar } from "../../src/components/PremiumTabBar";

export default function AdminLayout() {
  const { t } = useTranslation();

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
          <Tabs.Screen name="logistics" options={{ href: null }} />
          <Tabs.Screen name="inventory" options={{ href: null }} />
          <Tabs.Screen
            name="system"
            options={{
              title: t("tabs.system"),
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name="server"
                  size={size}
                  color={color}
                />
              ),
            }}
          />
          <Tabs.Screen name="reports" options={{ href: null }} />
          <Tabs.Screen name="config" options={{ href: null }} />
          <Tabs.Screen name="audit" options={{ href: null }} />
          <Tabs.Screen name="security-logs" options={{ href: null }} />
          <Tabs.Screen name="audiobooks" options={{ href: null }} />
        </Tabs>
        <DeferredBiblioAI />
      </View>
    </ErrorBoundary>
  );
}
