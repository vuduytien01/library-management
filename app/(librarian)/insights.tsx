import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BarChart, PieChart } from "react-native-chart-kit";
import { useLibrarianAnalytics } from "@/src/hooks/library/useLibrarianAnalytics";
import { useAnalytics } from "@/src/hooks/library/useAnalytics";
import { AnalyticsHeatmap } from "@/src/features/admin/components/AnalyticsHeatmap";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { InlineUndoButton } from "@/src/components/InlineUndoButton";

interface GenreTrend {
  category: string;
  borrow_count: string | number;
}

interface PeakHour {
  hour: number;
  count: number;
}

interface InventorySuggestion {
  id: string;
  suggestion_text: string;
  suggestion_text_en?: string;
  suggestion_text_vi?: string;
  confidence_score: number;
  type: "TRANSFER_ADVICE" | "PREDICTIVE_HOT";
  book?: { title: string };
  metadata?: {
    predicted_demand_increase?: string;
    priority?: string;
  };
}

export default function LibrarianInsights() {
  const { width } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const {
    getSuggestions,
    getGlobalTrends,
    runIntelligence,
    runPredictiveAnalysis,
  } = useLibrarianAnalytics();
  const {
    getBorrowingHeatmap,
    getRetentionStats,
    getInventoryHealth,
    getPeakHours,
  } = useAnalytics();

  const {
    data: suggestions,
    isLoading: isSuggestionsLoading,
    refetch: refetchSuggestions,
  } = getSuggestions();
  const { data: trends, isLoading: isTrendsLoading } = getGlobalTrends();
  const { data: heatmapData } = getBorrowingHeatmap();
  const { data: retention } = getRetentionStats();
  const { data: health } = getInventoryHealth();
  const { data: peakHours } = getPeakHours();
  const isEn = i18n.language?.startsWith("en");
  const chartWidth = Math.max(280, Math.min(width - 48, 720));
  const kpiCardWidth = width < 420 ? "100%" : Math.min((width - 60) / 2, 360);

  const [activeTab, setActiveTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchSuggestions();
    setRefreshing(false);
  };

  const chartConfig = {
    backgroundGradientFrom: "#151929",
    backgroundGradientTo: "#151929",
    color: (opacity = 1) => `rgba(58, 117, 242, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.6,
    useShadowColorFromDataset: false,
  };

  const renderKPI = (
    title: string,
    value: string | number,
    icon: string,
    color: string,
  ) => (
    <View style={[styles.kpiCard, { width: kpiCardWidth }]}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiTitle}>{title}</Text>
      </View>
    </View>
  );

  if (isSuggestionsLoading || isTrendsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A75F2" />
        <Text style={styles.loadingText}>
          {t("analytics.loading_insights")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0B0F1A", "#171B2B"]}
        style={styles.background}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3A75F2"
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {t("analytics.deep_analytics")}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t("analytics.staff_intelligence")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[styles.refreshBtn, { backgroundColor: "#10B981" }]}
              onPress={() => runPredictiveAnalysis.mutate()}
              disabled={runPredictiveAnalysis.isPending}
            >
              {runPredictiveAnalysis.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="trending-up" size={20} color="white" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => runIntelligence.mutate(i18n.language)}
              disabled={runIntelligence.isPending}
            >
              {runIntelligence.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="sparkles" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabsContainer}>
          {[
            { id: "overview", label: t("analytics.overview"), icon: "apps" },
            { id: "activity", label: t("analytics.activity"), icon: "pulse" },
            {
              id: "inventory",
              label: t("analytics.inventory"),
              icon: "library",
            },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? "#FFFFFF" : "#8B8FA3"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "overview" && (
          <Animated.View entering={FadeInDown} style={styles.tabContent}>
            <View style={styles.kpiGrid}>
              {renderKPI(
                t("analytics.kpi_members"),
                retention?.active_members || 0,
                "people",
                "#3A75F2",
              )}
              {renderKPI(
                t("analytics.kpi_return_rate"),
                `${retention?.return_rate || 0}%`,
                "return-down",
                "#10B981",
              )}
              {renderKPI(
                t("analytics.kpi_new_members"),
                retention?.new_members_this_month || 0,
                "person-add",
                "#F59E0B",
              )}
              {renderKPI(
                t("analytics.kpi_avg_duration"),
                `${retention?.avg_borrow_duration || 0}d`,
                "time",
                "#8B5CF6",
              )}
            </View>

            <Text style={styles.sectionTitle}>
              {t("analytics.genre_trends")}
            </Text>
            <View style={styles.chartCard}>
              <PieChart
                data={
                  trends?.genres.map((g: GenreTrend, i: number) => ({
                    name: g.category,
                    population:
                      typeof g.borrow_count === "string"
                        ? parseInt(g.borrow_count)
                        : g.borrow_count,
                    color: [
                      "#4F8EF7",
                      "#10B981",
                      "#F59E0B",
                      "#EF4444",
                      "#8B5CF6",
                    ][i % 5],
                    legendFontColor: "#FFFFFF",
                    legendFontSize: 12,
                  })) || []
                }
                width={chartWidth}
                height={200}
                chartConfig={chartConfig}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
            </View>
          </Animated.View>
        )}

        {activeTab === "activity" && (
          <Animated.View entering={FadeInDown} style={styles.tabContent}>
            <Text style={styles.sectionTitle}>
              {t("analytics.borrow_density")}
            </Text>
            <AnalyticsHeatmap data={heatmapData || []} />

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              {t("analytics.peak_hours")}
            </Text>
            <View style={styles.chartCard}>
              <BarChart
                data={{
                  labels: (peakHours || []).map((p: PeakHour) => `${p.hour}h`),
                  datasets: [
                    {
                      data: (peakHours || []).map((p: PeakHour) => p.count),
                    },
                  ],
                }}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig}
                style={{ borderRadius: 16 }}
              />
            </View>
          </Animated.View>
        )}

        {activeTab === "inventory" && (
          <Animated.View entering={FadeInDown} style={styles.tabContent}>
            <View style={styles.kpiGrid}>
              {renderKPI(
                t("analytics.out_of_stock"),
                health?.out_of_stock_count || 0,
                "close-circle",
                "#EF4444",
              )}
              {renderKPI(
                t("analytics.dead_stock"),
                health?.dead_stock_count || 0,
                "skull",
                "#5A5F7A",
              )}
            </View>

            <Text style={styles.sectionTitle}>
              {t("analytics.demand_forecast")}
            </Text>
            {(suggestions?.filter(
              (s: InventorySuggestion) => s.type === "PREDICTIVE_HOT",
            ).length || 0) > 0 ? (
              suggestions
                ?.filter(
                  (s: InventorySuggestion) => s.type === "PREDICTIVE_HOT",
                )
                .map((suggestion: InventorySuggestion) => (
                  <View
                    key={suggestion.id}
                    style={[
                      styles.suggestionCard,
                      { borderColor: "#10B98130" },
                    ]}
                  >
                    <View
                      style={[
                        styles.suggestionIcon,
                        { backgroundColor: "#10B98115" },
                      ]}
                    >
                      <Ionicons name="flame" size={24} color="#10B981" />
                    </View>
                    <View style={styles.suggestionContent}>
                      <View style={styles.suggestionMeta}>
                        <Text
                          style={[styles.confidenceText, { color: "#10B981" }]}
                        >
                          {t("analytics.confidence")}:{" "}
                          {Math.round(suggestion.confidence_score * 100)}%
                        </Text>
                        {suggestion.metadata?.priority && (
                          <Text
                            style={[
                              styles.priorityTag,
                              suggestion.metadata.priority === "HIGH" && {
                                color: "#EF4444",
                              },
                            ]}
                          >
                            {suggestion.metadata.priority}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.suggestionTitle}>
                        {isEn
                          ? suggestion.suggestion_text_en ||
                            suggestion.suggestion_text
                          : suggestion.suggestion_text_vi ||
                            suggestion.suggestion_text}
                      </Text>
                      {suggestion.book && (
                        <Text style={styles.bookInfo}>
                          {t("common.book_title")}: {suggestion.book.title}
                        </Text>
                      )}
                      {suggestion.metadata?.predicted_demand_increase && (
                        <Text style={styles.predictionDetail}>
                          {t("analytics.predicted_increase")}:{" "}
                          {suggestion.metadata.predicted_demand_increase}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {t("analytics.no_forecast_hint")}
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              {t("analytics.ai_advice")}
            </Text>
            {suggestions && suggestions.length > 0 ? (
              suggestions.map((suggestion: InventorySuggestion) => (
                <View key={suggestion.id} style={styles.suggestionCard}>
                  <View style={styles.suggestionIcon}>
                    <Ionicons
                      name={
                        suggestion.type === "TRANSFER_ADVICE"
                          ? "swap-horizontal"
                          : "alert-circle"
                      }
                      size={24}
                      color="#4F8EF7"
                    />
                  </View>
                  <View style={styles.suggestionContent}>
                    <View style={styles.suggestionMeta}>
                      <Text style={styles.confidenceText}>
                        {t("analytics.confidence")}:{" "}
                        {Math.round(suggestion.confidence_score * 100)}%
                      </Text>
                    </View>
                    <Text style={styles.suggestionTitle}>
                      {isEn
                        ? suggestion.suggestion_text_en ||
                          suggestion.suggestion_text
                        : suggestion.suggestion_text_vi ||
                          suggestion.suggestion_text}
                    </Text>
                    {suggestion.book && (
                      <Text style={styles.bookInfo}>
                        {t("common.book_title")}: {suggestion.book.title}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {t("analytics.no_advice_hint")}
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  background: { ...StyleSheet.absoluteFillObject },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
  },
  loadingText: { color: "#8B8FA3", marginTop: 12, fontSize: 14 },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "bold" },
  headerSubtitle: { color: "#8B8FA3", fontSize: 14, marginTop: 4 },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#151929",
    gap: 8,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  activeTab: {
    backgroundColor: "#3A75F2",
    borderColor: "#3A75F2",
  },
  tabText: { color: "#8B8FA3", fontSize: 13, fontWeight: "600" },
  activeTabText: { color: "#FFFFFF" },
  tabContent: { paddingHorizontal: 24 },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  kpiTitle: { color: "#5A5F7A", fontSize: 11, fontWeight: "600" },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: "#151929",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E2540",
    marginBottom: 24,
  },
  suggestionCard: {
    flexDirection: "row",
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  suggestionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#4F8EF715",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  suggestionContent: { flex: 1 },
  suggestionMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  confidenceText: { color: "#10B981", fontSize: 10, fontWeight: "bold" },
  suggestionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  bookInfo: { color: "#8B8FA3", fontSize: 12, marginTop: 4 },
  emptyCard: {
    padding: 40,
    backgroundColor: "#151929",
    borderRadius: 20,
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#3D4260",
  },
  emptyText: {
    color: "#5A5F7A",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  priorityTag: { fontSize: 10, fontWeight: "900", color: "#F59E0B" },
  predictionDetail: {
    color: "#10B981",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
});
