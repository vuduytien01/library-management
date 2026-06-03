import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useLibrary } from "../../src/hooks/useLibrary";
import { useAuthStore } from "../../src/store/useAuthStore";
import { LineChart, PieChart, ContributionGraph } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";

const chartConfig = {
  backgroundColor: "#0B0F1A",
  backgroundGradientFrom: "#0F172A",
  backgroundGradientTo: "#0B0F1A",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: "6",
    strokeWidth: "2",
    stroke: "#10B981",
  },
};

export default function AnalyticsScreen() {
  const { width } = useWindowDimensions();
  const { profile } = useAuthStore();
  const { analytics } = useLibrary();
  const chartWidth = Math.max(280, Math.min(width - 48, 720));

  const { data: genres, isLoading: loadingGenres } = analytics.getGenres(
    profile?.id,
  );
  const { data: activity, isLoading: loadingActivity } = analytics.getActivity(
    profile?.id,
  );
  const { data: monthly, isLoading: loadingMonthly } = analytics.getMonthly(
    profile?.id,
  );

  if (loadingGenres || loadingActivity || loadingMonthly) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A75F2" />
      </View>
    );
  }

  const pieData =
    genres?.map((g: any, i: number) => ({
      name: g.category,
      population: g.count,
      color: ["#10B981", "#34D399", "#059669", "#6EE7B7", "#065F46", "#A7F3D0"][
        i % 6
      ],
      legendFontColor: "#94A3B8",
      legendFontSize: 12,
    })) || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: "#10B981" }]}>
            AI Insights • Xu hướng
          </Text>
          <Text style={styles.subtitle}>
            Phân tích dữ liệu đọc sách thông minh
          </Text>
        </View>

        {/* Monthly Activity Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hoạt động mượn sách (6 tháng)</Text>
          {monthly && monthly.labels.length > 0 ? (
            <LineChart
              data={monthly}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          ) : (
            <Text style={styles.noData}>
              Chưa có đủ dữ liệu để hiển thị biểu đồ
            </Text>
          )}
        </View>

        {/* Genre Distribution */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phân bổ thể loại</Text>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          ) : (
            <Text style={styles.noData}>
              Mượn thêm sách để xem phân tích thể loại
            </Text>
          )}
        </View>

        {/* Activity Heatmap */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tần suất hoạt động</Text>
          {activity && activity.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ContributionGraph
                values={activity}
                endDate={new Date()}
                numDays={105}
                width={Math.max(chartWidth, width * 1.5)}
                height={220}
                chartConfig={chartConfig}
                tooltipDataAttrs={() => ({})}
              />
            </ScrollView>
          ) : (
            <Text style={styles.noData}>
              Bắt đầu mượn sách để xây dựng chuỗi hoạt động
            </Text>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <BlurView intensity={20} tint="light" style={styles.statBox}>
            <Ionicons name="book" size={24} color="#3A75F2" />
            <Text style={styles.statValue}>
              {genres?.reduce((acc: number, g: any) => acc + g.count, 0) || 0}
            </Text>
            <Text style={styles.statLabel}>Sách đã mượn</Text>
          </BlurView>
          <BlurView intensity={20} tint="light" style={styles.statBox}>
            <Ionicons name="flash" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{profile?.xp || 0}</Text>
            <Text style={styles.statLabel}>Tổng XP</Text>
          </BlurView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B0F1A",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#171B2B",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noData: {
    color: "#5A6376",
    textAlign: "center",
    marginVertical: 40,
    fontStyle: "italic",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 30,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
