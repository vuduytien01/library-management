import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/src/api/supabase";
import { adminService } from "@/src/features/admin/admin.service";
import {
  SecurityAuditResult,
  UserRole,
} from "@/src/features/admin/admin.types";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useRouter } from "expo-router";
import { useUndoStore } from "@/src/store/useUndoStore";
import { InlineUndoButton } from "@/src/components/InlineUndoButton";

export default function AdminSystem() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const { queueAction } = useUndoStore();
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [newUser, setNewUser] = React.useState({
    email: "",
    password: "",
    fullName: "",
    role: "MEMBER" as UserRole,
  });

  const [showAIEnrichModal, setShowAIEnrichModal] = React.useState(false);
  const [isEnriching, setIsEnriching] = React.useState(false);
  const [enrichProgress, setEnrichProgress] = React.useState({
    processed: 0,
    success: 0,
    failed: 0,
    remaining: true,
  });

  const [isAuditing, setIsAuditing] = React.useState(false);
  const [auditResult, setAuditResult] =
    React.useState<SecurityAuditResult | null>(null);
  const [users, setUsers] = React.useState<any[]>([]);

  const { data: statsData, refetch } = useQuery({
    queryKey: ["system_stats"],
    queryFn: async () => {
      const startTime = Date.now();
      // Simple query to measure latency
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      const latency = Date.now() - startTime;

      const { count: bookCount } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true });
      const { count: borrowCount } = await supabase
        .from("borrow_records")
        .select("*", { count: "exact", head: true });

      // Count books missing embeddings
      const { count: missingEmbeddings } = await supabase
        .from("books")
        .select("*, profiles:changed_by(fullName:full_name, role)", {
          count: "exact",
          head: true,
        })
        .is("embedding", null);

      // In a real app, storage info would come from an edge function or bucket metadata
      return {
        users: userCount || 0,
        books: bookCount || 0,
        missingEmbeddings: missingEmbeddings || 0,
        borrows: borrowCount || 0,
        uptime: "99.99%",
        server: "Supabase Cloud (SGP)",
        latency: latency,
        storage: {
          used: 1.24, // GB
          total: 5.0, // GB
          percentage: 24.8,
        },
        apiStatus: "Healthy",
        version: "v2.0.4-premium",
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const refetchStats = refetch;

  const { data: fetchedUsers, refetch: refetchUsers } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      try {
        const data = await adminService.listUsers();
        setUsers(data);
        return data;
      } catch (err) {
        console.error("Error fetching users:", err);
        return [];
      }
    },
  });

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      Alert.alert(t("common.error"), t("messages.no_results")); // Or generic message
      return;
    }

    setIsCreating(true);
    try {
      await adminService.createUser(newUser);
      setShowAddModal(false);
      setNewUser({ email: "", password: "", fullName: "", role: "MEMBER" });
      refetchUsers();
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUser = (
    userId: string,
    updates: any,
    userName?: string,
  ) => {
    const previousUsers = [...users];

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)),
    );

    queueAction({
      message:
        updates.isLocked !== undefined
          ? updates.isLocked
            ? t("admin.lock_pending", { name: userName || userId })
            : t("admin.unlock_pending", { name: userName || userId })
          : t("librarian.user_updated_pending", { name: userName || userId }),
      onCommit: async () => {
        try {
          await adminService.updateUser(userId, updates);
          refetchUsers();
        } catch (error: any) {
          setUsers(previousUsers);
          Alert.alert(t("common.error"), error.message);
        }
      },
      onUndo: () => {
        setUsers(previousUsers);
      },
    });
  };

  const handleDeleteUser = (userId: string, userName?: string) => {
    const previousUsers = [...users];

    // Optimistic update
    setUsers((prev) => prev.filter((u) => u.id !== userId));

    queueAction({
      message: t("admin.user_deletion_pending", { name: userName || userId }),
      onCommit: async () => {
        try {
          await adminService.deleteUser(userId);
          refetchUsers();
        } catch (error: any) {
          setUsers(previousUsers);
          Alert.alert(t("common.error"), error.message);
        }
      },
      onUndo: () => {
        setUsers(previousUsers);
      },
    });
  };

  const handleRunSecurityAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await adminService.runSecurityAudit();
      setAuditResult(result);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleConfirmAIEnrich = async () => {
    try {
      setIsEnriching(true);
      setEnrichProgress({
        processed: 0,
        success: 0,
        failed: 0,
        remaining: true,
      });

      let hasMore = true;
      let totalProcessed = 0;
      let totalSuccess = 0;
      let totalFailed = 0;

      while (hasMore) {
        const result = await adminService.backfillEmbeddings();

        totalProcessed += result.processed || 0;
        totalSuccess += result.updated || 0;
        totalFailed += result.failed || 0;

        setEnrichProgress({
          processed: totalProcessed,
          success: totalSuccess,
          failed: totalFailed,
          remaining: result.remaining !== "All pending books processed.",
        });

        if (
          result.remaining === "All pending books processed." ||
          result.processed === 0
        ) {
          hasMore = false;
        }
      }

      Alert.alert(
        t("common.success"),
        `${t("admin.ai_enrich_complete")}: ${totalSuccess} ${t("admin.books_processed")}`,
      );
      refetchStats();
      setShowAIEnrichModal(false);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message || t("common.error_occurred"));
    } finally {
      setIsEnriching(false);
    }
  };

  const MonitorWidget = ({ label, value, icon, color, progress }: any) => (
    <View style={styles.monitorWidget}>
      <View style={styles.monitorWidgetHeader}>
        <View
          style={[
            styles.monitorWidgetIconContainer,
            { backgroundColor: `${color}15` },
          ]}
        >
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.monitorWidgetLabel}>{label}</Text>
      </View>
      <Text style={styles.monitorWidgetValue}>{value}</Text>
      {typeof progress === "number" && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, Math.max(0, progress))}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      )}
    </View>
  );

  const StatCard = ({ title, value, subValue, icon, color, onPress }: any) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={styles.statCard}
    >
      <View style={styles.statCardContent}>
        <View>
          <Text style={styles.statCardTitle}>{title}</Text>
          <Text style={styles.statCardValue}>{value}</Text>
          <Text style={[styles.statCardSubValue, { color }]}>{subValue}</Text>
        </View>
        <View
          style={[
            styles.statCardIconContainer,
            { backgroundColor: `${color}15` },
          ]}
        >
          <Ionicons name={icon} size={28} color={color} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title} accessibilityRole="header">
            {t("tabs.system")}
          </Text>
          <Text style={styles.subtitle}>{t("admin.system_desc")}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <InlineUndoButton />
          <View
            style={styles.statusBadge}
            accessibilityLabel={`${t("admin.status_online")}: OK`}
          >
            <Text style={styles.statusText}>{t("admin.status_online")}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* System Monitor Ops Widgets */}
        <View style={styles.monitorGrid}>
          <MonitorWidget
            label={t("admin.api_status")}
            value={
              statsData?.apiStatus === "Healthy"
                ? t("admin.status_online")
                : statsData?.apiStatus || "---"
            }
            icon="pulse"
            color="#10B981"
          />
          <MonitorWidget
            label={t("admin.db_latency")}
            value={`${statsData?.latency || 0}ms`}
            icon="speedometer"
            color={
              statsData?.latency && statsData.latency > 500
                ? "#EF4444"
                : "#4F8EF7"
            }
          />
          <MonitorWidget
            label={t("admin.storage")}
            value={`${statsData?.storage?.used || 0}GB / ${statsData?.storage?.total || 0}GB`}
            icon="cloud-upload"
            color="#A855F7"
            progress={statsData?.storage?.percentage}
          />
          <MonitorWidget
            label={t("admin.uptime")}
            value={statsData?.uptime || "---"}
            icon="time"
            color="#F59E0B"
          />
          <TouchableOpacity
            onPress={() => setShowAIEnrichModal(true)}
            style={styles.aiEmbedButton}
            accessibilityRole="button"
            accessibilityLabel={t("admin.ai_enrich_title")}
          >
            <View
              style={[
                styles.aiEmbedContent,
                {
                  borderColor:
                    statsData?.missingEmbeddings &&
                    statsData.missingEmbeddings > 0
                      ? "#4F8EF7"
                      : "#1E2540",
                  borderStyle:
                    statsData?.missingEmbeddings &&
                    statsData.missingEmbeddings > 0
                      ? "dashed"
                      : "solid",
                  borderWidth: 1.5,
                },
              ]}
            >
              <View style={styles.aiEmbedLeft}>
                <View
                  style={[
                    styles.aiEmbedIconContainer,
                    { backgroundColor: "rgba(79, 142, 247, 0.1)" },
                  ]}
                >
                  <Ionicons name="sparkles" size={22} color="#4F8EF7" />
                </View>
                <View>
                  <Text style={[styles.userName, { fontSize: 16 }]}>
                    {t("admin.ai_embeddings")}
                  </Text>
                  <Text
                    style={[
                      styles.userRole,
                      {
                        color:
                          (statsData?.missingEmbeddings || 0) > 0
                            ? "#4F8EF7"
                            : "#5A5F7A",
                      },
                    ]}
                  >
                    {t("admin.books_missing_embeddings", {
                      count: statsData?.missingEmbeddings || 0,
                    })}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    color: "#4F8EF7",
                    fontSize: 12,
                    fontWeight: "700",
                    marginRight: 4,
                  }}
                >
                  {t("common.start")}
                </Text>
                <Ionicons name="play-circle" size={16} color="#4F8EF7" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.logHeader}>
          <StatCard
            title={t("analytics.kpi_members")}
            value={statsData?.users || 0}
            subValue={`+12% ${t("common.total_borrows")}`}
            icon="people"
            color="#4F8EF7"
            onPress={() => router.push("/(admin)?scroll=users")}
          />
          <StatCard
            title={t("admin.available_books")}
            value={statsData?.books || 0}
            subValue={t("admin.growth_stable")}
            icon="library"
            color="#10B981"
            onPress={() => router.push("/(admin)/inventory")}
          />
        </View>

        {/* User Management Section */}
        <View style={styles.chartContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("tabs.users")}</Text>
            <View style={styles.userActions}>
              <TouchableOpacity
                onPress={() => setShowAddModal(true)}
                style={styles.labelMargin}
              >
                <Ionicons name="add-circle" size={24} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => refetchUsers()}>
                <Ionicons name="refresh" size={20} color="#4F8EF7" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.userCardList}>
            {users?.map((user: any, index: number) => {
              const isSelf = user.id === profile?.id;
              return (
                <View
                  key={user.id}
                  style={[
                    styles.userItem,
                    {
                      borderBottomWidth:
                        index === (users?.length || 0) - 1 ? 0 : 1,
                      borderBottomColor: "#1E2540",
                    },
                  ]}
                >
                  <View style={styles.userItemInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>
                        {user.fullName || user.email}
                      </Text>
                      {user.isLocked && (
                        <View style={styles.lockBadge}>
                          <Text style={styles.lockText}>
                            {t("admin.lock_status")}
                          </Text>
                        </View>
                      )}
                      {user.isSuperAdmin && (
                        <View
                          style={[
                            styles.lockBadge,
                            { backgroundColor: "rgba(168, 85, 247, 0.2)" },
                          ]}
                        >
                          <Text style={[styles.lockText, { color: "#A855F7" }]}>
                            {t("admin.super_admin")}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userRole}>
                      {user.role
                        ? t(`roles.${user.role.toLowerCase()}`)?.toUpperCase()
                        : ""}{" "}
                      • {user.email}
                    </Text>
                  </View>
                  <View style={styles.userActions}>
                    {!isSelf && !user.isSuperAdmin && (
                      <>
                        <TouchableOpacity
                          onPress={() =>
                            handleUpdateUser(
                              user.id,
                              { isLocked: !user.isLocked },
                              user.fullName || user.email,
                            )
                          }
                          style={styles.userActionBtn}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name={
                              user.isLocked
                                ? "lock-open-outline"
                                : "lock-closed-outline"
                            }
                            size={20}
                            color={user.isLocked ? "#10B981" : "#F59E0B"}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            handleDeleteUser(
                              user.id,
                              user.fullName || user.email,
                            )
                          }
                          style={styles.smallPadding}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#EF4444"
                          />
                        </TouchableOpacity>
                      </>
                    )}
                    {isSelf && (
                      <View style={{ padding: 8 }}>
                        <Ionicons
                          name="person-circle-outline"
                          size={20}
                          color="#4F8EF7"
                        />
                      </View>
                    )}
                    {!isSelf && user.isSuperAdmin && (
                      <View style={{ padding: 8 }}>
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={20}
                          color="#A855F7"
                        />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            {(!users || users.length === 0) && (
              <Text style={styles.emptyText}>{t("messages.no_results")}</Text>
            )}
          </View>
        </View>

        {/* Security Audit Section */}
        <View style={styles.sectionMargin}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{t("admin.security_rls")}</Text>
              <Text style={styles.sectionSubtitle}>
                {t("admin.security_desc")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRunSecurityAudit}
              disabled={isAuditing}
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    auditResult?.status === "RISK" ? "#EF444420" : "#10B98120",
                  borderColor:
                    auditResult?.status === "RISK" ? "#EF444440" : "#10B98140",
                },
              ]}
            >
              {isAuditing ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        auditResult?.status === "RISK" ? "#EF4444" : "#10B981",
                    },
                  ]}
                >
                  {auditResult ? t("common.refresh") : t("admin.run_audit")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {auditResult ? (
            <View style={styles.auditCard}>
              <View style={styles.auditHeader}>
                <View
                  style={[
                    styles.auditIconContainer,
                    {
                      backgroundColor:
                        auditResult.status === "SECURE"
                          ? "#10B98115"
                          : "#EF444415",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      auditResult.status === "SECURE"
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={24}
                    color={
                      auditResult.status === "SECURE" ? "#10B981" : "#EF4444"
                    }
                  />
                </View>
                <View>
                  <Text style={styles.auditTitle}>
                    {auditResult.status === "SECURE"
                      ? t("admin.secure_system")
                      : t("admin.risk_detected")}
                  </Text>
                  <Text style={styles.auditTimestamp}>
                    {t("admin.audit_timestamp")}:{" "}
                    {new Date(auditResult.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </View>

              {/* RLS Missing */}
              {auditResult.rls_missing.length > 0 && (
                <View style={styles.mb16}>
                  <Text style={[styles.riskHeader, { color: "#EF4444" }]}>
                    {t("admin.missing_rls")}:
                  </Text>
                  <View style={styles.riskTags}>
                    {auditResult.rls_missing.map((table) => (
                      <View
                        key={table}
                        style={[
                          styles.riskTag,
                          { backgroundColor: "#EF444415" },
                        ]}
                      >
                        <Text
                          style={[styles.riskTagText, { color: "#EF4444" }]}
                        >
                          {table}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* IDOR Risks */}
              {auditResult.permissive_policies.length > 0 && (
                <View style={styles.mb16}>
                  <Text style={[styles.riskHeader, { color: "#F59E0B" }]}>
                    {t("admin.idor_risk")}:
                  </Text>
                  {auditResult.permissive_policies.map((p, i) => (
                    <View key={i} style={styles.mb6}>
                      <Text style={styles.itemText}>
                        • <Text style={styles.boldText}>{p.table}</Text>:{" "}
                        {p.policy} ({p.cmd})
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Public Exposure */}
              {auditResult.sensitive_public_read.length > 0 && (
                <View style={styles.mb16}>
                  <Text style={[styles.riskHeader, { color: "#A855F7" }]}>
                    {t("admin.sensitive_public")}:
                  </Text>
                  <View style={styles.riskTags}>
                    {auditResult.sensitive_public_read.map((table) => (
                      <View
                        key={table}
                        style={[
                          styles.riskTag,
                          { backgroundColor: "#A855F715" },
                        ]}
                      >
                        <Text
                          style={[styles.riskTagText, { color: "#A855F7" }]}
                        >
                          {table}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {auditResult.status === "SECURE" && (
                <Text
                  style={{
                    color: "#10B981",
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 10,
                  }}
                >
                  {t("admin.all_secure")}
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleRunSecurityAudit}
              style={{
                backgroundColor: "#151929",
                borderRadius: 24,
                padding: 40,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#1E2540",
                borderStyle: "dashed",
              }}
            >
              <Ionicons
                name="scan-outline"
                size={48}
                color="#4F8EF7"
                style={styles.faded}
              />
              <Text
                style={{
                  color: "#8B8FA3",
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 16,
                }}
              >
                {t("admin.no_audit_data")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={{
            marginTop: 32,
            padding: 24,
            backgroundColor: "rgba(79, 142, 247, 0.05)",
            borderRadius: 24,
            borderStyle: "dashed",
            borderWidth: 1,
            borderColor: "rgba(79, 142, 247, 0.2)",
          }}
        >
          <Text
            style={{
              color: "#4F8EF7",
              fontSize: 13,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("admin.server_optimized", {
              server: statsData?.server || "Supabase Singapore",
            })}
          </Text>
          <Text
            style={{
              color: "#5A5F7A",
              fontSize: 11,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            {t("admin.version_label")}: {statsData?.version || "v2.0"} •{" "}
            {t("admin.audit_timestamp")}: {new Date().toLocaleTimeString()}
          </Text>
        </View>
      </ScrollView>

      {/* Add User Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.8)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#1E2540",
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: "#2E3654",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 20,
              }}
            >
              {t("admin.add_member")}
            </Text>

            <TextInput
              placeholder={t("admin.full_name")}
              placeholderTextColor="#5A5F7A"
              style={{
                backgroundColor: "#0B0F1A",
                color: "#FFFFFF",
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
              }}
              value={newUser.fullName}
              onChangeText={(text) =>
                setNewUser((p) => ({ ...p, fullName: text }))
              }
            />
            <TextInput
              placeholder={t("admin.email")}
              placeholderTextColor="#5A5F7A"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: "#0B0F1A",
                color: "#FFFFFF",
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
              }}
              value={newUser.email}
              onChangeText={(text) =>
                setNewUser((p) => ({ ...p, email: text }))
              }
            />
            <TextInput
              placeholder={t("admin.password")}
              placeholderTextColor="#5A5F7A"
              secureTextEntry
              style={{
                backgroundColor: "#0B0F1A",
                color: "#FFFFFF",
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
              }}
              value={newUser.password}
              onChangeText={(text) =>
                setNewUser((p) => ({ ...p, password: text }))
              }
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              {["MEMBER", "LIBRARIAN", "ADMIN"]
                .filter((r) => profile?.is_super_admin || r === "MEMBER")
                .map((role) => (
                  <TouchableOpacity
                    key={role}
                    onPress={() =>
                      setNewUser((p) => ({
                        ...p,
                        role: role as "MEMBER" | "LIBRARIAN" | "ADMIN",
                      }))
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor:
                        newUser.role === role ? "#4F8EF7" : "#0B0F1A",
                      borderWidth: 1,
                      borderColor:
                        newUser.role === role ? "#4F8EF7" : "#2E3654",
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: newUser.role === role }}
                  >
                    <Text
                      style={{
                        color: newUser.role === role ? "#FFFFFF" : "#8B8FA3",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {t(`roles.${role.toLowerCase()}`)?.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.btnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateUser}
                disabled={isCreating}
                style={{
                  flex: 2,
                  backgroundColor: "#4F8EF7",
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isCreating ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.btnText}>{t("admin.create_user")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Enrich Modal */}
      <Modal visible={showAIEnrichModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#171B2B",
              borderRadius: 28,
              padding: 28,
              borderWidth: 1,
              borderColor: "#22293F",
              width: "100%",
              maxWidth: 400,
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(79, 142, 247, 0.12)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Ionicons name="sparkles" size={32} color="#4F8EF7" />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {t("admin.ai_enrich_title")}
            </Text>

            <Text
              style={{
                color: "#8B8FA3",
                fontSize: 14,
                lineHeight: 22,
                marginBottom: 28,
                textAlign: "center",
              }}
            >
              {t("admin.ai_enrich_msg")}
            </Text>

            {isEnriching && (
              <View style={{ width: "100%", marginBottom: 24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#8B8FA3", fontSize: 12 }}>
                    {t("admin.processing", "Đang xử lý...")}
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {enrichProgress.processed} {t("admin.books", "sách")}
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: "#22293F",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: "100%",
                      backgroundColor: "#4F8EF7",
                      opacity: 0.6,
                    }}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#10B981",
                        marginRight: 4,
                      }}
                    />
                    <Text style={{ color: "#10B981", fontSize: 11 }}>
                      {enrichProgress.success} OK
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#EF4444",
                        marginRight: 4,
                      }}
                    />
                    <Text style={{ color: "#EF4444", fontSize: 11 }}>
                      {enrichProgress.failed} ERR
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={{ width: "100%" }}>
              <TouchableOpacity
                onPress={handleConfirmAIEnrich}
                disabled={isEnriching}
                style={{
                  backgroundColor: "#4F8EF7",
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: "center",
                  marginBottom: 12,
                  flexDirection: "row",
                  justifyContent: "center",
                  shadowColor: "#4F8EF7",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                }}
              >
                {isEnriching ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Ionicons
                    name="sparkles"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text
                  style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}
                >
                  {t("admin.ai_enrich_start")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAIEnrichModal(false)}
                disabled={isEnriching}
                style={{
                  backgroundColor: "transparent",
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#22293F",
                }}
              >
                <Text
                  style={{ color: "#5A5F7A", fontSize: 15, fontWeight: "500" }}
                >
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 0 : 20,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#8B8FA3",
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: "#10B98120",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#10B98140",
  },
  statusText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  monitorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  monitorWidget: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 16,
    width: "48%",
    borderWidth: 1,
    borderColor: "#1E2540",
    marginBottom: 16,
  },
  monitorWidgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  monitorWidgetIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  monitorWidgetLabel: {
    color: "#8B8FA3",
    fontSize: 12,
    fontWeight: "600",
  },
  monitorWidgetValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  progressContainer: {
    height: 4,
    backgroundColor: "#1E2540",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  aiEmbedButton: {
    width: "100%",
    marginBottom: 16,
  },
  aiEmbedContent: {
    backgroundColor: "#1E2540",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 0,
    borderColor: "transparent",
  },
  aiEmbedLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiEmbedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#4F8EF715",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  statCard: {
    backgroundColor: "#1E2540",
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: "transparent",
  },
  statCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statCardTitle: {
    color: "#8B8FA3",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statCardValue: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 12,
  },
  statCardSubValue: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  statCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#8B8FA3",
    fontSize: 12,
    marginTop: 2,
  },
  userCardList: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 20,
    borderWidth: 0,
    borderColor: "transparent",
  },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  userItemInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  userRole: {
    color: "#8B8FA3",
    fontSize: 12,
  },
  lockBadge: {
    marginLeft: 8,
    backgroundColor: "#EF444420",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lockText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "700",
  },
  userActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  userActionBtn: {
    padding: 8,
    marginRight: 4,
  },
  emptyText: {
    color: "#5A5F7A",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
  auditCard: {
    backgroundColor: "#151929",
    borderRadius: 24,
    padding: 20,
    borderWidth: 0,
    borderColor: "transparent",
  },
  auditHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  auditIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  auditTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  auditTimestamp: {
    color: "#8B8FA3",
    fontSize: 12,
  },
  riskHeader: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  riskTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  riskTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riskTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1E2540",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#2E3654",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "#8B8FA3",
    fontSize: 14,
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#0B0F1A",
    color: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E2540",
    alignItems: "center",
  },
  roleOptionActive: {
    backgroundColor: "#4F8EF720",
    borderColor: "#4F8EF7",
  },
  roleText: {
    color: "#8B8FA3",
    fontSize: 12,
    fontWeight: "600",
  },
  roleTextActive: {
    color: "#4F8EF7",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },
  createBtn: {
    flex: 2,
    backgroundColor: "#4F8EF7",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  mb6: { marginBottom: 6 },
  mb16: { marginBottom: 16 },
  itemText: { color: "#FFFFFF", fontSize: 13 },
  boldText: { fontWeight: "700" },
  faded: { opacity: 0.5 },
  labelMargin: { marginRight: 12 },
  smallPadding: { padding: 4 },
  sectionMargin: { marginTop: 32 },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  chartContainer: {
    backgroundColor: "#151929",
    borderRadius: 24,
    padding: 24,
    borderWidth: 0,
    borderColor: "transparent",
    marginBottom: 24,
  },
});
