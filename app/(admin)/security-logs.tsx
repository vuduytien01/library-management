import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { auditService } from "../../src/services/auditService";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { InlineUndoButton } from "../../src/components/InlineUndoButton";

export default function SecurityLogScreen() {
  const { t } = useTranslation();
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: () => auditService.getLogs(100),
    refetchInterval: 10000, // Refresh every 10s
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const getIcon = (action: string) => {
    switch (action) {
      case "BOOK_ADD":
        return "book-outline";
      case "BOOK_DELETE":
        return "trash-outline";
      case "MEMBER_APPOINT":
        return "ribbon-outline";
      case "BORROW_APPROVE":
        return "checkmark-circle-outline";
      case "BORROW_REJECT":
        return "close-circle-outline";
      default:
        return "shield-outline";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "#FF5252";
      case "WARNING":
        return "#FFB300";
      default:
        return "#4CAF50";
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>{t("tabs.security_logs")}</Text>
          <InlineUndoButton />
        </View>
        <Text style={styles.subtitle}>{t("admin.audit_logs_desc")}</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={styles.actionBadge}>
                <Ionicons
                  name={getIcon(item.action_type) as any}
                  size={16}
                  color="#00E5FF"
                />
                <Text style={styles.actionText}>{item.action_type}</Text>
              </View>
              <Text style={styles.timeText}>
                {format(new Date(item.created_at), "HH:mm:ss")}
              </Text>
            </View>

            <Text style={styles.actorText}>
              {t("admin.performer")}:{" "}
              <Text style={styles.actorName}>
                {item.actor?.fullName || t("admin.system")}
              </Text>
              <Text style={styles.roleTag}> ({item.actor?.role})</Text>
            </Text>

            <View
              style={[
                styles.severityBar,
                { backgroundColor: getSeverityColor(item.severity) },
              ]}
            />

            {item.target_id && (
              <Text style={styles.targetText}>
                {t("admin.record_id")}: {item.target_id}
              </Text>
            )}

            {Object.keys(item.metadata).length > 0 && (
              <Text style={styles.metaText}>
                {JSON.stringify(item.metadata)}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2540",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#E6F1FF",
  },
  subtitle: {
    fontSize: 14,
    color: "#8892B0",
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  logCard: {
    backgroundColor: "#151929",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4F8EF7",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 229, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionText: {
    color: "#00E5FF",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 6,
  },
  timeText: {
    color: "#8892B0",
    fontSize: 12,
  },
  actorText: {
    color: "#8892B0",
    fontSize: 14,
  },
  actorName: {
    color: "#CCD6F6",
    fontWeight: "600",
  },
  roleTag: {
    fontSize: 12,
    fontStyle: "italic",
  },
  severityBar: {
    height: 2,
    width: "100%",
    marginTop: 8,
    borderRadius: 1,
  },
  targetText: {
    color: "#8892B0",
    fontSize: 13,
    marginTop: 8,
  },
  metaText: {
    color: "#495670",
    fontSize: 11,
    marginTop: 4,
    fontFamily: "monospace",
  },
});
