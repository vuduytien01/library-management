import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../src/api/supabase";
import { useTranslation } from "react-i18next";
import { useLibrary } from "../../src/hooks/useLibrary";
import { BranchMap } from "../../src/features/admin/components/BranchMap";
import { AnimatedWrapper } from "../../src/components/AnimatedWrapper";
import { router } from "expo-router";

interface Transfer {
  id: string;
  book_isbn: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
  status: "PENDING" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  created_at: string;
  book: { title: string };
  from_branch: { name: string };
  to_branch: { name: string };
}

export default function LogisticsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { logistics } = useLibrary();

  const { data: transfers, isLoading, refetch } = logistics.getTransfers();
  const { data: aiSuggestions, isLoading: isAiLoading } =
    logistics.getAiSuggestions();

  const executeMutation = logistics.executeTransfer;
  const completeMutation = logistics.completeTransfer;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("inventory_transfers")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_transfers"] });
      Alert.alert(t("common.success"), t("logistics.update_success"));
    },
    onError: (err) => {
      Alert.alert(t("common.error"), err.message);
    },
  });

  const getBranchDisplayName = (name: string) => {
    if (!name) return "";
    const lower = name.toLowerCase();
    if (
      lower.includes("south") ||
      lower.includes("miền nam") ||
      lower.includes("hồ chí minh") ||
      lower.includes("hcm")
    ) {
      return t("admin.branch_south", "South Branch - TP.HCM");
    }
    if (
      lower.includes("main") ||
      lower.includes("chính") ||
      lower.includes("hà nội") ||
      lower.includes("hn")
    ) {
      return t("admin.branch_main", "Main Branch - Hà Nội");
    }
    return name;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return "time-outline";
      case "SHIPPING":
        return "airplane-outline";
      case "COMPLETED":
        return "checkmark-circle-outline";
      case "CANCELLED":
        return "close-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "#F59E0B";
      case "SHIPPING":
        return "#3A75F2";
      case "COMPLETED":
        return "#10B981";
      case "CANCELLED":
        return "#EF4444";
      default:
        return "#8B8FA3";
    }
  };

  const renderTransferItem = ({ item }: { item: Transfer }) => (
    <View style={styles.card}>
      <LinearGradient
        colors={["#1E2540", "#171B2B"]}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle}>
              {item.book?.title || t("common.loading")}
            </Text>
            <Text style={styles.isbnText}>
              {t("common.isbn")}: {item.book_isbn}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(item.status) + "20",
                borderColor: getStatusColor(item.status),
              },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status)}
              size={12}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {t(`logistics.status_${item.status.toLowerCase()}`)}
            </Text>
          </View>
        </View>

        <View style={styles.logisticsPath}>
          <View style={styles.branchPoint}>
            <Ionicons name="business" size={16} color="#4F8EF7" />
            <Text style={styles.branchName} numberOfLines={1}>
              {getBranchDisplayName(item.from_branch?.name)}
            </Text>
          </View>
          <View style={styles.pathLine}>
            <View style={styles.line} />
            <Ionicons name="chevron-forward" size={14} color="#3D4260" />
            <View style={styles.line} />
          </View>
          <View style={styles.branchPoint}>
            <Ionicons name="location" size={16} color="#10B981" />
            <Text style={styles.branchName} numberOfLines={1}>
              {getBranchDisplayName(item.to_branch?.name)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.quantityText}>
            {t("logistics.transfer_quantity")}
            <Text style={styles.bold}>{item.quantity}</Text>
          </Text>
          <View style={styles.actions}>
            {item.status === "PENDING" && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() =>
                  updateStatus.mutate({ id: item.id, status: "SHIPPING" })
                }
              >
                <Text style={styles.actionBtnText}>
                  {t("logistics.start_shipping")}
                </Text>
              </TouchableOpacity>
            )}
            {item.status === "SHIPPING" && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.successBtn]}
                onPress={() => completeMutation.mutate(item.id)}
              >
                <Text style={styles.actionBtnText}>
                  {t("logistics.complete_shipping")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderAiSuggestion = ({ item }: { item: any }) => (
    <View style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <Ionicons name="sparkles" size={16} color="#4F8EF7" />
        <Text style={styles.suggestionTitle}>{item.book_title}</Text>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            {Math.round(item.confidence * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.suggestionPath}>
        <Text style={styles.pathText}>
          {getBranchDisplayName(item.from_branch_name)}
        </Text>
        <Ionicons name="arrow-forward" size={12} color="#5A5F7A" />
        <Text style={styles.pathText}>
          {getBranchDisplayName(item.to_branch_name)}
        </Text>
      </View>

      <Text style={styles.reasonText}>{item.reason}</Text>

      <TouchableOpacity
        style={styles.executeBtn}
        onPress={() =>
          executeMutation.mutate({
            isbn: item.book_isbn,
            fromBranchId: item.from_branch_id,
            toBranchId: item.to_branch_id,
            quantity: item.quantity,
          })
        }
        disabled={executeMutation.isPending}
      >
        {executeMutation.isPending ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.executeBtnText}>
            {t("logistics.execute_transfer", { count: item.quantity })}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("logistics.title")}</Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={transfers}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <BranchMap />

            <View style={styles.sectionHeader}>
              <Ionicons name="bulb-outline" size={20} color="#4F8EF7" />
              <Text style={styles.sectionTitle}>
                {t("logistics.ai_suggestions")}
              </Text>
            </View>

            {isAiLoading ? (
              <View style={styles.suggestionLoading}>
                <ActivityIndicator color="#4F8EF7" />
                <Text style={styles.loadingText}>
                  {t("logistics.loading_ai")}
                </Text>
              </View>
            ) : (
              <FlatList
                horizontal
                data={aiSuggestions}
                renderItem={renderAiSuggestion}
                keyExtractor={(item, idx) => idx.toString()}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {t("logistics.empty_ai_suggestions")}
                  </Text>
                }
              />
            )}

            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={20} color="#FFFFFF" />
              <Text style={styles.sectionTitle}>{t("logistics.history")}</Text>
            </View>
          </View>
        )}
        renderItem={renderTransferItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={64} color="#1E2540" />
              <Text style={styles.emptyText}>
                {t("logistics.empty_transfers")}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  backBtn: { padding: 4 },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1E2540",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  refreshBtn: { backgroundColor: "#1E2540", padding: 10, borderRadius: 12 },
  list: { padding: 20 },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  cardGradient: { padding: 20 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  bookInfo: { flex: 1, marginRight: 12 },
  bookTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  isbnText: { color: "#8B8FA3", fontSize: 12, marginTop: 4 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  statusText: { fontSize: 10, fontWeight: "800" },
  logisticsPath: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 15,
    borderRadius: 16,
    marginBottom: 16,
  },
  branchPoint: { flex: 1, alignItems: "center", gap: 6 },
  branchName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  pathLine: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  line: { width: 15, height: 1, backgroundColor: "#3D4260" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quantityText: { color: "#8B8FA3", fontSize: 14 },
  bold: { color: "#FFFFFF", fontWeight: "bold" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    backgroundColor: "#3A75F2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  successBtn: { backgroundColor: "#10B981" },
  actionBtnText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyText: {
    color: "#3D4260",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  listHeader: { paddingBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  suggestionList: { paddingRight: 20 },
  suggestionCard: {
    width: 280,
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 16,
    marginRight: 16,
    borderWidth: 1,
    borderColor: "#3A75F240",
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  suggestionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  confidenceBadge: {
    backgroundColor: "#3A75F220",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: { color: "#3A75F2", fontSize: 10, fontWeight: "900" },
  suggestionPath: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  pathText: { color: "#8B8FA3", fontSize: 12 },
  reasonText: {
    color: "#5A5F7A",
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 12,
    lineHeight: 16,
  },
  executeBtn: {
    backgroundColor: "#3A75F2",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  executeBtnText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  suggestionLoading: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { color: "#5A5F7A", fontSize: 12 },
});
