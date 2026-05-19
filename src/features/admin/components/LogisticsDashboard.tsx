import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import LogisticsMap from "./LogisticsMap";
import { supabase } from "../../../api/supabase";
import { adminService } from "../admin.service";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { PROVINCES_34 } from "../../../constants/logistics";
import React, { useEffect, useState } from "react";

interface LogisticsTask {
  id: string;
  book_title: string;
  from_branch: { name: string; latitude: number; longitude: number };
  to_branch: { name: string; latitude: number; longitude: number };
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  quantity: number;
  distanceTier: "REGIONAL" | "NATIONAL";
}

export const LogisticsDashboard = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<LogisticsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from("inventory_transfers")
          .select(
            "*, from_branch:from_branch_id(name, latitude, longitude, province_v2_id), to_branch:to_branch_id(name, latitude, longitude, province_v2_id)",
          )
          .neq("status", "COMPLETED");

        if (error) throw error;

        let processedTasks = (data || []).map((item) => {
          const fromProvince = PROVINCES_34.find(
            (p) => p.id === item.from_branch.province_v2_id,
          );
          const toProvince = PROVINCES_34.find(
            (p) => p.id === item.to_branch.province_v2_id,
          );
          const isNational = fromProvince?.region !== toProvince?.region;

          return {
            ...item,
            distanceTier: isNational ? "NATIONAL" : "REGIONAL",
          } as LogisticsTask;
        });

        if (processedTasks.length === 0) {
          processedTasks = [
            {
              id: "mock-1",
              book_title: "Clean Code",
              from_branch: { name: "Hà Nội Main", latitude: 21.0285, longitude: 105.8542 },
              to_branch: { name: "HCMC Central", latitude: 10.7626, longitude: 106.6602 },
              status: "IN_PROGRESS",
              quantity: 15,
              distanceTier: "NATIONAL",
            },
            {
              id: "mock-2",
              book_title: "Harry Potter",
              from_branch: { name: "Đà Nẵng Hub", latitude: 16.0544, longitude: 108.2022 },
              to_branch: { name: "Huế Branch", latitude: 16.4637, longitude: 107.5909 },
              status: "PENDING",
              quantity: 8,
              distanceTier: "REGIONAL",
            },
          ];
        }
        setTasks(processedTasks);
      } catch (err) {
        console.error("Fetch logistics error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
    const subscription = supabase
      .channel("logistics_live")
      .on(
        "postgres_changes" as any, 
        { event: "*", schema: "public", table: "inventory_transfers" }, 
        () => fetchTasks()
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(subscription);
    };
  }, []);

  const StatCard = ({ icon, label, value, color }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={icon} color={color} size={20} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );

  const handleStartShipping = async (id: string) => {
    try {
      if (id.startsWith("mock-")) return;
      await adminService.updateTransferStatus(id, "IN_PROGRESS");
    } catch (err) {
      console.error("Start shipping error:", err);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      if (id.startsWith("mock-")) {
        setTasks(prev => prev.filter(t => t.id !== id));
        return;
      }
      await adminService.completeTransfer(id);
    } catch (err) {
      console.error("Complete transfer error:", err);
    }
  };

  const renderTask = (item: LogisticsTask) => {
    const isHighPriority = item.distanceTier === "NATIONAL";
    const canStart = item.status === "PENDING";
    const canComplete = item.status === "IN_PROGRESS";

    return (
      <View 
        key={item.id} 
        style={[
          styles.taskCard,
          hoveredTaskId === item.id && styles.taskCardHovered
        ]}
        // @ts-ignore - Web hover support
        onMouseEnter={() => setHoveredTaskId(item.id)}
        onMouseLeave={() => setHoveredTaskId(null)}
      >
        <View style={styles.taskIcon}>
          <Ionicons name="cube-outline" size={20} color="#3A75F2" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle}>{item.book_title}</Text>
          <Text style={styles.taskRoute}>
            {item.from_branch.name} → {item.to_branch.name}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: item.status === "IN_PROGRESS" ? "#3A75F2" : "#8B8FA3" }]} />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View style={styles.badgeRow}>
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityText}>x{item.quantity}</Text>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: isHighPriority ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)" }]}>
              <Text style={[styles.priorityText, { color: isHighPriority ? "#EF4444" : "#10B981" }]}>
                {isHighPriority ? t("admin.priority_high") : t("admin.priority_standard")}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {canStart && (
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => handleStartShipping(item.id)}
              >
                <Text style={styles.actionButtonText}>{t("admin.start_shipping")}</Text>
              </TouchableOpacity>
            )}
            {canComplete && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: "#10B981" }]} 
                onPress={() => handleComplete(item.id)}
              >
                <Text style={styles.actionButtonText}>{t("admin.complete_shipping")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color="#3A75F2" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={Platform.OS === 'web' ? styles.splitLayout : styles.verticalLayout}>
        {/* Left Column: Fixed Map */}
        <View style={styles.mapColumn}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t("admin.logistics_title")}</Text>
              <View style={styles.liveBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard icon="truck-delivery" label={t("admin.active_deliveries")} value={tasks.length.toString()} color="#3A75F2" />
            <StatCard icon="package-variant-closed" label={t("admin.in_transit")} value={tasks.filter(t => t.status === 'IN_PROGRESS').length.toString()} color="#10B981" />
          </View>

          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>{t("admin.visual_map")}</Text>
            <View style={styles.mapWrapper}>
              <LogisticsMap 
                tasks={tasks} 
                hoveredTaskId={hoveredTaskId}
              />
            </View>
          </View>
        </View>

        {/* Right Column: Scrollable List */}
        <View style={styles.listColumn}>
          <Text style={styles.sectionTitle}>{t("admin.recent_activity")}</Text>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {tasks.map(renderTask)}
            {tasks.length === 0 && <Text style={styles.emptyText}>{t("admin.no_logs")}</Text>}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1a1d2d" }] },
  { featureType: "water", stylers: [{ color: "#0a0c14" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a5f7a" }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  splitLayout: { flexDirection: "row", flex: 1, height: Platform.OS === 'web' ? '100vh' : 'auto', overflow: 'hidden' },
  verticalLayout: { flexDirection: "column", flex: 1 },
  
  mapColumn: { 
    flex: Platform.OS === 'web' ? 5 : undefined,
    height: Platform.OS === 'web' ? '100%' : 350,
    padding: Platform.OS === 'web' ? 24 : 16, 
    borderRightWidth: Platform.OS === 'web' ? 1 : 0, 
    borderRightColor: "#1E2540",
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderBottomColor: "#1E2540",
    backgroundColor: '#0B0F1A'
  },
  listColumn: { 
    flex: Platform.OS === 'web' ? 5 : 1, 
    padding: Platform.OS === 'web' ? 24 : 16, 
    backgroundColor: "#0B0F1A" 
  },

  header: { marginBottom: 20 },
  title: { color: "#FFF", fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(239, 68, 68, 0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444", marginRight: 6 },
  liveText: { color: "#EF4444", fontSize: 10, fontWeight: "900" },
  
  statsGrid: { flexDirection: "row", marginTop: 20, gap: 12 },
  statCard: { flex: 1, backgroundColor: "#151929", padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: "#1E2540" },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValue: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  statLabel: { color: "#8B8FA3", fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  
  mapSection: { flex: 1, marginTop: 20 },
  sectionTitle: { color: "#FFF", fontSize: 14, fontWeight: "700", marginBottom: 16, textTransform: "uppercase", opacity: 0.7 },
  mapWrapper: { 
    flex: 1,
    borderRadius: 24, 
    overflow: "hidden", 
    borderWidth: 1, 
    borderColor: "#1E2540",
    backgroundColor: '#0B0F1A'
  },
  
  listContent: { paddingBottom: 40 },
  taskCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#151929", 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: "#1E2540" 
  },
  taskCardHovered: { borderColor: "#4facfe", backgroundColor: "#1e2540" },
  taskIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(58, 117, 242, 0.1)", justifyContent: "center", alignItems: "center", marginRight: 12 },
  taskTitle: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  taskRoute: { color: "#8B8FA3", fontSize: 11, marginTop: 2 },
  
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  quantityBadge: { backgroundColor: "#3A75F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  quantityText: { color: "#FFF", fontSize: 9, fontWeight: "900" },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 9, fontWeight: "800" },
  
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: "#8B8FA3", fontSize: 10, fontWeight: "600" },
  
  actionRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  actionButton: { backgroundColor: "#3A75F2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  actionButtonText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  emptyText: { color: "#5A5F7A", textAlign: "center", marginTop: 40 },
});
