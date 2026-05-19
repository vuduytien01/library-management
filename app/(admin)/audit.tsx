import { Ionicons } from "@expo/vector-icons";
import { InlineUndoButton } from "../../src/components/InlineUndoButton";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { BlurView } from "expo-blur";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/api/supabase";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  changed_by: string;
  created_at: string;
  profiles?: {
    fullName: string;
    role: string;
  };
}

export default function AuditLogsScreen() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const {
    data: allLogs,
    isLoading,
    refetch,
  } = useQuery<AuditLog[]>({
    queryKey: ["audit_logs_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles:changed_by(fullName:full_name, role)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    staleTime: 5000,
    gcTime: 5 * 60 * 1000,
  });

  const logs = React.useMemo(() => {
    if (!allLogs) return [];
    if (!filter) return allLogs;
    return allLogs.filter((log) => log.action === filter);
  }, [allLogs, filter]);

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT":
        return "#10B981";
      case "UPDATE":
        return "#3A75F2";
      case "DELETE":
        return "#EF4444";
      default:
        return "#5A5F7A";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "INSERT":
        return t("admin.action_insert");
      case "UPDATE":
        return t("admin.action_update");
      case "DELETE":
        return t("admin.action_delete");
      default:
        return action;
    }
  };

  const renderLogItem = ({ item }: { item: AuditLog }) => {
    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View
            style={[
              styles.actionBadge,
              { backgroundColor: getActionColor(item.action) + "20" },
            ]}
          >
            <Text
              style={[
                styles.actionText,
                { color: getActionColor(item.action) },
              ]}
            >
              {getActionLabel(item.action)}
            </Text>
          </View>
          <Text style={styles.timestamp}>
            {format(new Date(item.created_at), "HH:mm • dd/MM/yyyy", {
              locale: i18n.language === "vi" ? vi : enUS,
            })}
          </Text>
        </View>

        <View style={styles.logBody}>
          <View style={styles.row}>
            <Text style={styles.label}>{t("admin.table")}:</Text>
            <Text style={styles.value}>{item.table_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("admin.record_id")}:</Text>
            <Text style={styles.value} numberOfLines={1}>
              {item.record_id}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("admin.performer")}:</Text>
            <Text style={styles.value}>
              {item.profiles?.fullName || t("admin.system")}
            </Text>
          </View>
        </View>

        {(item.old_data || item.new_data) && (
          <TouchableOpacity
            style={styles.diffBtn}
            activeOpacity={0.7}
            onPress={() => setSelectedLog(item)}
          >
            <Ionicons name="eye-outline" size={16} color="#4F8EF7" />
            <Text style={styles.diffText}>{t("admin.view_diff")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const JsonDiffModal = () => {
    if (!selectedLog) return null;

    const renderJson = (data: any) => {
      if (!data) return <Text style={styles.nullText}>N/A</Text>;
      return (
        <Text style={styles.jsonText}>{JSON.stringify(data, null, 2)}</Text>
      );
    };

    return (
      <Modal
        visible={!!selectedLog}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLog(null)}
      >
        <BlurView intensity={100} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("admin.view_diff")}</Text>
              <TouchableOpacity onPress={() => setSelectedLog(null)}>
                <Ionicons name="close-circle" size={28} color="#8A8F9E" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.diffContainer}>
                <View style={styles.diffColumn}>
                  <Text style={styles.diffLabel}>{t("admin.old_data")}</Text>
                  <View style={styles.jsonWrapper}>
                    {renderJson(selectedLog.old_data)}
                  </View>
                </View>

                <View style={styles.diffDivider} />

                <View style={styles.diffColumn}>
                  <Text style={styles.diffLabel}>{t("admin.new_data")}</Text>
                  <View
                    style={[styles.jsonWrapper, { borderColor: "#10B98140" }]}
                  >
                    {renderJson(selectedLog.new_data)}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSelectedLog(null)}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="shield-checkmark" size={32} color="#3A75F2" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{t("tabs.audit")}</Text>
            <Text style={styles.subtitle}>{t("admin.audit_logs_desc")}</Text>
          </View>
        </View>
        <InlineUndoButton />
      </View>

      <View style={styles.filterBar}>
        {["ALL", "INSERT", "UPDATE", "DELETE"].map((f) => (
          <TouchableOpacity
            key={f}
            activeOpacity={0.8}
            style={[
              styles.filterChip,
              (filter === f || (f === "ALL" && !filter)) &&
                styles.activeFilterChip,
            ]}
            onPress={() => setFilter(f === "ALL" ? null : f)}
          >
            <Text
              style={[
                styles.filterChipText,
                (filter === f || (f === "ALL" && !filter)) &&
                  styles.activeFilterChipText,
              ]}
            >
              {f === "ALL" ? t("admin.all_actions") : getActionLabel(f)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F8EF7" />
        </View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderLogItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="documents-outline" size={48} color="#1E2540" />
              <Text style={styles.emptyText}>{t("admin.no_logs")}</Text>
            </View>
          }
        />
      )}

      <JsonDiffModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  header: { padding: 24, paddingTop: 60 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  title: { color: "#FFF", fontSize: 24, fontWeight: "bold" },
  subtitle: { color: "#5A5F7A", fontSize: 14, marginTop: 4 },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 15,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#151929",
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  activeFilterChip: { backgroundColor: "#3A75F2", borderColor: "#3A75F2" },
  filterChipText: { color: "#5A5F7A", fontSize: 12, fontWeight: "bold" },
  activeFilterChipText: { color: "#FFF" },
  listContent: { padding: 24, paddingTop: 0 },
  logCard: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  actionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  actionText: { fontSize: 10, fontWeight: "bold", letterSpacing: 1 },
  timestamp: { color: "#5A5F7A", fontSize: 11, fontWeight: "600" },
  logBody: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  label: { color: "#5A5F7A", fontSize: 13, width: 100, fontWeight: "600" },
  value: { color: "#FFFFFF", fontSize: 13, fontWeight: "500", flex: 1 },
  diffBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1E2540",
    paddingTop: 16,
    gap: 8,
  },
  diffText: { color: "#4F8EF7", fontSize: 12, fontWeight: "700" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: { color: "#5A5F7A", fontSize: 16, marginTop: 12 },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#0F121D",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: "80%",
    padding: 24,
    borderTopWidth: 1,
    borderColor: "#1E2540",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold" },
  modalBody: { flex: 1 },
  diffContainer: { gap: 20 },
  diffColumn: { flex: 1 },
  diffLabel: {
    color: "#8A8F9E",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  jsonWrapper: {
    backgroundColor: "#07090F",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  jsonText: {
    color: "#E1E1E1",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  nullText: { color: "#5A5F7A", fontSize: 12, fontStyle: "italic" },
  diffDivider: { height: 1, backgroundColor: "#1E2540", marginVertical: 10 },
});
