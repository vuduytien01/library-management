import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLibrary } from "../../src/hooks/useLibrary";
import { useTranslation } from "react-i18next";
import { PieChart, BarChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";
import { InlineUndoButton } from "../../src/components/InlineUndoButton";

export default function LibrarianReports() {
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const { books, borrows } = useLibrary();
  const { data: allBooks, isLoading: loadingBooks } = books.list();
  const { data: allBorrows, isLoading: loadingBorrows } = borrows.listAll();
  const [isMounted, setIsMounted] = useState(true);
  const chartWidth = Math.max(280, Math.min(width - 48, 720));
  const statCardWidth = width < 420 ? "100%" : Math.min((width - 60) / 2, 360);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (loadingBooks || loadingBorrows) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4F8EF7" />
        <Text style={styles.loadingText}>{t("messages.loading")}</Text>
      </View>
    );
  }

  // Statistics calculation
  const totalBooks = allBooks?.length || 0;
  const totalCopies =
    allBooks?.reduce((acc: number, b: any) => acc + (b.total_copies || 0), 0) ||
    0;
  const activeBorrows =
    allBorrows?.filter((b: any) => b.status === "BORROWED").length || 0;
  const overdueBorrows =
    allBorrows?.filter(
      (b: any) =>
        b.status === "BORROWED" &&
        b.due_date &&
        new Date(b.due_date) < new Date(),
    ).length || 0;

  // Category Distribution for Pie Chart
  const categories: Record<string, number> = {};
  allBooks?.forEach((b: any) => {
    const cat = b.category
      ? String(t("categories." + b.category, b.category))
      : String(t("common.other"));
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const pieData = Object.entries(categories)
    .map(([name, count], index) => ({
      name,
      population: count,
      color: ["#4F8EF7", "#10B981", "#F59E0B", "#EF4444", "#A855F7", "#6366F1"][
        index % 6
      ],
      legendFontColor: "#8B8FA3",
      legendFontSize: 12,
    }))
    .sort((a, b) => b.population - a.population)
    .slice(0, 6);

  // Monthly Borrows (Simulated/Mock since we only have raw records)
  const months = t("common.months_short", { returnObjects: true }) as string[];
  const barData = {
    labels: months.slice(1, 7), // T2-T7 or Feb-Jul
    datasets: [{ data: [12, 19, 15, 24, 18, 30] }],
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("librarian.reports_stats")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("librarian.reports_stats_desc")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollArea}
      >
        {/* Main Stats Row */}
        <View style={styles.statsGrid}>
          <View
            style={[
              styles.statCard,
              { width: statCardWidth, backgroundColor: "#1C2541" },
            ]}
          >
            <Ionicons name="library" size={24} color="#4F8EF7" />
            <Text style={styles.statValue}>{totalCopies}</Text>
            <Text style={styles.statLabel}>{t("common.total_copies")}</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { width: statCardWidth, backgroundColor: "#132A24" },
            ]}
          >
            <Ionicons name="book" size={24} color="#10B981" />
            <Text style={styles.statValue}>{activeBorrows}</Text>
            <Text style={styles.statLabel}>{t("librarian.borrowing")}</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { width: statCardWidth, backgroundColor: "#301A1A" },
            ]}
          >
            <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
            <Text style={styles.statValue}>{overdueBorrows}</Text>
            <Text style={styles.statLabel}>{t("librarian.overdue_books")}</Text>
          </View>
        </View>

        {/* Charts */}
        <Text style={styles.sectionTitle}>{t("analytics.genre_trends")}</Text>
        <View style={styles.chartCard}>
          <PieChart
            data={pieData}
            width={chartWidth}
            height={200}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>

        <Text style={styles.sectionTitle}>{t("analytics.borrow_density")}</Text>
        <View style={styles.chartCard}>
          <BarChart
            data={barData}
            width={chartWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              ...chartConfig,
              backgroundGradientFrom: "#151929",
              backgroundGradientTo: "#151929",
            }}
            style={{ borderRadius: 16, marginTop: 10 }}
          />
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => {
            if (isMounted)
              Alert.alert(t("common.notice"), t("analytics.export_pdf_dev"));
          }}
        >
          <LinearGradient
            colors={["#4F8EF7", "#3A75F2"]}
            style={styles.exportGradient}
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.exportText}>{t("analytics.export_pdf")}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const chartConfig = {
  backgroundGradientFrom: "#151929",
  backgroundGradientTo: "#151929",
  color: (opacity = 1) => `rgba(79, 142, 247, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(139, 143, 163, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.6,
  useShadowColorFromDataset: false,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#8B8FA3", marginTop: 12 },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  headerSubtitle: { color: "#8B8FA3", fontSize: 14, marginTop: 4 },
  scrollArea: { paddingHorizontal: 24, paddingBottom: 40 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 12,
  },
  statLabel: { color: "#8B8FA3", fontSize: 12, marginTop: 4 },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    marginTop: 8,
  },
  chartCard: {
    backgroundColor: "#151929",
    borderRadius: 24,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  exportBtn: { borderRadius: 16, overflow: "hidden", marginTop: 10 },
  exportGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  exportText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
