import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
    ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../src/api/supabase";
import { useLibrary } from "../../src/hooks/useLibrary";

export default function DemandPredictionPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { analytics } = useLibrary();
  const [isRunningAi, setIsRunningAi] = useState(false);

  const { data: insights, isLoading } = analytics.getDeepInsights();

  const runAiMutation = useMutation({
    mutationFn: async () => {
      setIsRunningAi(true);
      // Simulate/Trigger AI calculation RPC
      const { error } = await supabase.rpc("fn_generate_demand_forecast");
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deep_insights"] });
      Alert.alert(t("common.success"), t("analytics.forecast_success"));
    },
    onError: (err) => {
      Alert.alert(t("common.error"), err.message);
    },
    onSettled: () => {
      setIsRunningAi(false);
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F8EF7" />
        <Text style={styles.loadingText}>{t("analytics.loading_insights")}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("analytics.demand_forecast")}</Text>
        </View>
        <TouchableOpacity
          style={styles.aiBtn}
          onPress={() => runAiMutation.mutate()}
          disabled={isRunningAi}
        >
          {isRunningAi ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.aiBtnText}>{t("analytics.run_ai")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <LinearGradient
            colors={["#3A75F2", "#2563EB"]}
            style={styles.kpiCard}
          >
            <Text style={styles.kpiLabel}>
              {t("analytics.kpi_active_members")}
            </Text>
            <Text style={styles.kpiValue}>
              {insights?.stats?.active_members || 0}
            </Text>
            <Text style={styles.kpiTrend}>
              +12% {t("analytics.kpi_new_members")}
            </Text>
          </LinearGradient>

          <View style={styles.kpiCardOutline}>
            <Text style={styles.kpiLabelDark}>
              {t("analytics.kpi_overdue")}
            </Text>
            <Text style={styles.kpiValueDark}>
              {insights?.stats?.overdue_count || 0}
            </Text>
            <Ionicons
              name="alert-circle"
              size={24}
              color="#EF4444"
              style={styles.kpiIcon}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("analytics.hot_titles")}</Text>
        {(insights?.demand?.length ?? 0) > 0 ? (
          insights?.demand?.map((item: any, idx: number) => (
            <TouchableOpacity key={idx} style={styles.demandCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.bookTitle} numberOfLines={1}>
                  {item.book_title}
                </Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {t("analytics.confidence")}:{" "}
                    {Math.round(item.confidence * 100)}%
                  </Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>
                    {t("analytics.velocity")}
                  </Text>
                  <Text style={styles.metricValue}>{item.velocity}x</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>
                    {t("analytics.predicted_increase")}
                  </Text>
                  <Text style={[styles.metricValue, { color: "#10B981" }]}>
                    +{item.predicted_growth}%
                  </Text>
                </View>
              </View>

              <View style={styles.adviceRow}>
                <View style={styles.adviceTag}>
                  <Text style={styles.adviceText}>
                    {t("analytics.advice_inventory")}
                  </Text>
                </View>
                <Text style={styles.adviceDesc} numberOfLines={2}>
                  {item.recommendation || t("messages.no_suggestions")}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics" size={48} color="#1E2540" />
            <Text style={styles.emptyText}>
              {t("analytics.no_forecast_hint")}
            </Text>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#5A5F7A"
          />
          <Text style={styles.disclaimerText}>
            {t("analytics.ai_disclaimer")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  backBtn: { padding: 4 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B0F1A",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#8B8FA3", marginTop: 16, fontSize: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2540",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  aiBtn: {
    flexDirection: "row",
    backgroundColor: "#3A75F2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  aiBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  scroll: { padding: 20 },
  kpiRow: { flexDirection: "row", gap: 16, marginBottom: 32 },
  kpiCard: { flex: 1, padding: 20, borderRadius: 24 },
  kpiCardOutline: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1E2540",
    backgroundColor: "#151929",
  },
  kpiLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  kpiLabelDark: { color: "#8B8FA3", fontSize: 12, fontWeight: "600" },
  kpiValue: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    marginVertical: 4,
  },
  kpiValueDark: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    marginVertical: 4,
  },
  kpiTrend: { color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: "700" },
  kpiIcon: { position: "absolute", right: 20, bottom: 20, opacity: 0.2 },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  demandCard: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  bookTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  confidenceBadge: {
    backgroundColor: "#3A75F220",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: { color: "#3A75F2", fontSize: 10, fontWeight: "800" },
  metricsRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  metric: { flex: 1 },
  metricLabel: { color: "#5A5F7A", fontSize: 11, marginBottom: 4 },
  metricValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: "#1E2540",
    marginHorizontal: 20,
  },
  adviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#0B0F1A",
    padding: 12,
    borderRadius: 12,
  },
  adviceTag: {
    backgroundColor: "#10B98120",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adviceText: { color: "#10B981", fontSize: 9, fontWeight: "900" },
  adviceDesc: { color: "#8B8FA3", fontSize: 12, flex: 1, lineHeight: 16 },
  emptyCard: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#151929",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1E2540",
    borderStyle: "dashed",
  },
  emptyText: {
    color: "#5A5F7A",
    marginTop: 12,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    opacity: 0.5,
  },
  disclaimerText: { color: "#5A5F7A", fontSize: 11 },
});
