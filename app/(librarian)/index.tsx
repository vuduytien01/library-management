import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useLibrary } from "@/src/hooks/useLibrary";
import { useRouter } from "expo-router";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { LanguageMenuToggle } from "@/src/components/LanguageSwitcher";
import { supabase } from "@/src/api/supabase";
import { BranchMap } from "@/src/features/admin/components/BranchMap";
import {
  logisticsService,
  RedistributionSuggestion,
} from "@/src/services/logisticsService";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";

export default function LibrarianDashboard() {
  const { width } = useWindowDimensions();
  const [isProfileMenuVisible, setIsProfileMenuVisible] = React.useState(false);
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.profile);
  const logout = useAuthStore((state) => state.logout);
  const updateAvatar = useAuthStore((state) => state.updateAvatar);
  const router = useRouter();
  const { books, borrows } = useLibrary();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingAvatar(true);

        const fileName = `${user?.id || "user"}_${Date.now()}.jpg`;
        const filePath = `avatars/${fileName}`;

        let body: any;
        if (asset.base64) {
          body = decode(asset.base64);
        } else {
          const response = await fetch(asset.uri);
          body = await response.blob();
        }

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, body, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", user?.id);

        if (updateError) throw updateError;

        updateAvatar(publicUrl);
        Alert.alert(t("common.success"), t("messages.avatar_updated"));
      }
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("messages.upload_failed"),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Real data fetching
  const { data: allBooks } = books.list();
  const { data: allBorrows } = borrows.listAll();

  // Accurate aggregates
  const totalCopies =
    allBooks?.reduce((acc: number, b: any) => acc + (b.total_copies || 0), 0) ||
    0;
  const activeBorrows =
    allBorrows?.filter((b: any) => b.status === "BORROWED").length || 0;
  const pendingApprovals =
    allBorrows?.filter((b: any) => b.status === "PENDING").length || 0;
  const isNarrow = width < 520;
  const statCardWidth = isNarrow ? "48%" : "31.5%";
  const actionCardWidth = width < 420 ? "48%" : width < 760 ? "31.5%" : "23.8%";

  // Làn 3: Operational Excellence & Logistics 2.0
  const [suggestions, setSuggestions] = React.useState<
    RedistributionSuggestion[]
  >([]);
  const [isAiLoading, setIsAiLoading] = React.useState(false);

  const fetchAiSuggestions = async () => {
    setIsAiLoading(true);
    try {
      const recs = await logisticsService.getAIRedistributionSuggestions(
        i18n.language,
      );
      setSuggestions(recs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const highDemandBooks =
    allBooks
      ?.filter((book: any) => {
        const borrowCount =
          allBorrows?.filter((b: any) => b.isbn === book.isbn).length || 0;
        return borrowCount >= 3; // Simple heuristic: 3+ borrows = High Demand
      })
      .slice(0, 3) || [];
  const [duplicateCount, setDuplicateCount] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;
    const checkDupes = async () => {
      const { data } = await supabase.rpc("get_duplicate_books");
      if (isMounted) {
        setDuplicateCount(data?.length || 0);
      }
    };
    checkDupes();
    return () => {
      isMounted = false;
    };
  }, [allBooks]);

  const handleSendReminders = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("send-reminders");
      if (error) throw error;

      const count = data?.count || 0;
      if (count > 0) {
        Alert.alert(
          t("common.success"),
          t("librarian.reminders_sent", { count }),
        );
      } else {
        Alert.alert(t("common.notice"), t("librarian.no_reminders"));
      }
    } catch (err: any) {
      console.error("Error sending reminders:", err);
      Alert.alert(t("common.error"), err.message || t("common.error_occurred"));
    }
  };

  const stats = [
    {
      label: t("librarian.total_books"),
      value: totalCopies,
      icon: "library",
      bgColor: "#3A75F2",
      flex: 1.6,
    },
    {
      label: t("librarian.borrowing"),
      value: activeBorrows,
      icon: "book",
      bgColor: "#10B981",
      flex: 1.2,
    },
    {
      label: t("common.pending"),
      value: pendingApprovals,
      icon: "time",
      bgColor: "#F59E0B",
      flex: 0.8,
    },
  ];

  const actions = [
    {
      title: t("librarian.scan_return"),
      icon: "scan-outline",
      iconBg: "#1C2541",
      iconColor: "#3A75F2",
      onPress: () => router.push("/(librarian)/books"),
    },
    {
      title: t("librarian.approve_borrow"),
      icon: "checkmark-circle-outline",
      iconBg: "#132A24",
      iconColor: "#10B981",
      onPress: () => router.push("/(librarian)/borrows"),
    },
    {
      title: t("librarian.add_book"),
      icon: "add-circle-outline",
      iconBg: "#23153A",
      iconColor: "#A855F7",
      onPress: () => router.push("/(librarian)/books"),
    },
    {
      title: t("analytics.deep_analytics"),
      icon: "analytics",
      iconBg: "#1C2541",
      iconColor: "#3A75F2",
      onPress: () => router.push("/(librarian)/insights"),
    },
    {
      title: t("librarian.reports_stats"),
      icon: "stats-chart",
      iconBg: "#301F0E",
      iconColor: "#F59E0B",
      onPress: () => router.push("/(librarian)/reports"),
    },
    {
      title: t("librarian.demand_ai"),
      icon: "analytics-outline",
      iconBg: "#132A24",
      iconColor: "#10B981",
      onPress: () => router.push("/(librarian)/demand-prediction"),
    },
    {
      title: t("librarian.cleanup"),
      icon: "trash-outline",
      iconBg: "#1A1D2E",
      iconColor: "#FF6B6B",
      onPress: () => router.push("/(librarian)/cleanup"),
    },
    {
      title: t("librarian.metadata_sources"),
      icon: "globe-outline",
      iconBg: "#1C2541",
      iconColor: "#3A75F2",
      onPress: () => router.push("/(librarian)/sources"),
    },
    {
      title: t("librarian.push_reminders"),
      icon: "notifications-outline",
      iconBg: "#301F0E",
      iconColor: "#F59E0B",
      onPress: handleSendReminders,
    },
    {
      title: t("librarian.broadcast_all"),
      icon: "megaphone-outline",
      iconBg: "#1C2541",
      iconColor: "#3A75F2",
      onPress: () => router.push("/(librarian)/broadcast"),
    },
    {
      title: t("audiobook.title"),
      icon: "headset",
      iconBg: "#23153A",
      iconColor: "#EC4899",
      onPress: () => router.push("/(librarian)/audiobooks"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F121D" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Minimal Header with Profile Dropdown */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>{t("librarian.welcome")},</Text>
            <Text style={styles.name}>
              {user?.fullName || t("common.librarian")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.push("/notifications" as any)}
              style={styles.notifBtn}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#3A75F2"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsProfileMenuVisible(true)}
              style={[styles.avatarBtn, { marginLeft: 12 }]}
            >
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {user?.fullName?.charAt(0) || "L"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Dropdown Menu */}
        <Modal
          visible={isProfileMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsProfileMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setIsProfileMenuVisible(false)}
          >
            <Animated.View
              entering={FadeInUp.duration(300)}
              style={styles.menuContent}
            >
              <View style={styles.menuHeader}>
                <Text style={styles.menuUserTitle}>
                  {user?.fullName || t("common.librarian")}
                </Text>
                <Text style={styles.menuUserSub}>
                  {user?.email} •{" "}
                  {user?.role ? t(`roles.${user.role.toLowerCase()}`) : ""}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  router.push("/profile" as any);
                }}
              >
                <Ionicons name="person-outline" size={18} color="#8A8F9E" />
                <Text style={styles.menuItemText}>{t("common.profile")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  router.push("/settings" as any);
                }}
              >
                <Ionicons name="settings-outline" size={18} color="#8A8F9E" />
                <Text style={styles.menuItemText}>{t("common.settings")}</Text>
              </TouchableOpacity>

              <LanguageMenuToggle />

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={[styles.menuItem, styles.signOutItem]}
                onPress={() => {
                  setIsProfileMenuVisible(false);
                  logout();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
                <Text style={[styles.menuItemText, { color: "#FF6B6B" }]}>
                  {t("common.logout")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* DUPLICATE WARNING BANNER */}
        {duplicateCount > 0 && (
          <TouchableOpacity
            style={styles.dupeBanner}
            onPress={() => router.push("/(librarian)/cleanup")}
            activeOpacity={0.9}
          >
            <View style={styles.dupeBannerContent}>
              <Ionicons name="warning" size={20} color="#FF6B6B" />
              <Text style={styles.dupeBannerText}>
                {t("librarian.dupe_detected", { count: duplicateCount })}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#FF6B6B" />
            </View>
          </TouchableOpacity>
        )}

        {/* Stats Row - Exact Visual Match */}
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[
                styles.statCard,
                { backgroundColor: stat.bgColor, width: statCardWidth },
              ]}
            >
              <View style={styles.statTop}>
                <Ionicons
                  name={stat.icon as any}
                  size={20}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Làn 3: Trend Analysis / Intelligence Section */}
        <Text style={styles.sectionTitle}>{t("librarian.map_inventory")}</Text>
        <View style={styles.mapWrapper}>
          <BranchMap />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleNoMargin}>
            {t("librarian.logistics_ai")}
          </Text>
          <TouchableOpacity
            style={styles.aiActionBtn}
            onPress={fetchAiSuggestions}
            disabled={isAiLoading}
          >
            {isAiLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                <Text style={styles.aiActionText}>
                  {t("librarian.run_ai_analysis")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.intelligenceRow}>
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, idx) => (
              <View key={idx} style={styles.intelligenceCard}>
                <View style={styles.intelHeader}>
                  <Ionicons name="swap-horizontal" size={16} color="#10B981" />
                  <Text style={styles.intelBadge}>
                    {t("librarian.ai_suggestion_badge")}
                  </Text>
                  <Text style={styles.confidenceText}>
                    {Math.round(suggestion.confidence * 100)}%{" "}
                    {t("common.match")}
                  </Text>
                </View>
                <Text style={styles.intelTitle} numberOfLines={1}>
                  {suggestion.book_title}
                </Text>
                <View style={styles.transferPath}>
                  <Text style={styles.pathBranch}>
                    {suggestion.from_branch_name}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="#3A75F2" />
                  <Text style={styles.pathBranch}>
                    {suggestion.to_branch_name}
                  </Text>
                </View>
                <Text style={styles.intelHint}>
                  {t("common.quantity")}: {suggestion.quantity}{" "}
                  {t("common.copies")} - {suggestion.reason}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyIntel}>
              <Ionicons
                name="analytics-outline"
                size={32}
                color="#1F263B"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.emptyIntelText}>
                {t("librarian.ai_analysis_hint")}
              </Text>
            </View>
          )}
        </View>

        {/* Lane 20: Predictive Intelligence Section */}
        <Text style={styles.sectionTitle}>
          {t("analytics.ai_intelligence")}
        </Text>
        <View style={styles.intelligenceRow}>
          <TouchableOpacity
            style={[
              styles.intelligenceCard,
              {
                borderColor: "rgba(58, 117, 242, 0.2)",
                backgroundColor: "#1A2138",
              },
            ]}
            onPress={() => router.push("/(librarian)/demand-prediction")}
          >
            <View style={styles.intelHeader}>
              <Ionicons name="sparkles" size={16} color="#3A75F2" />
              <Text style={[styles.intelBadge, { color: "#3A75F2" }]}>
                {t("analytics.demand_forecast").toUpperCase()}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color="#3A75F2"
                style={{ marginLeft: "auto" }}
              />
            </View>
            <Text style={styles.intelTitle}>
              {t("analytics.demand_forecast")}
            </Text>
            <Text style={styles.intelHint}>
              {t("analytics.demand_forecast_desc")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Actions Section */}
        <Text style={styles.sectionTitle}>{t("librarian.quick_actions")}</Text>
        <View style={styles.actionList}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionCard, { width: actionCardWidth }]}
              onPress={action.onPress}
              activeOpacity={0.8}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: action.iconBg }]}
              >
                <Ionicons
                  name={action.icon as any}
                  size={18}
                  color={action.iconColor}
                />
              </View>
              <Text style={styles.actionTitle} numberOfLines={2}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F121D", // Exact background from screenshot
  },
  scroll: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  welcome: {
    fontSize: 13,
    color: "#8A8F9E",
    marginBottom: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginLeft: 12,
  },
  cameraOverlayBtn: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#3A75F2",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0F121D",
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#3A75F2",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1F263B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#3A75F2",
    fontWeight: "bold",
    fontSize: 16,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 20,
  },
  menuContent: {
    width: 200,
    backgroundColor: "#171B2B",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: "#1F263B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  menuHeader: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    marginBottom: 4,
  },
  menuUserTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  menuUserSub: {
    color: "#8A8F9E",
    fontSize: 10,
    marginTop: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    gap: 10,
  },
  menuItemText: {
    color: "#E1E4ED",
    fontSize: 13,
    fontWeight: "500",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 4,
  },
  signOutItem: {
    marginTop: 2,
  },
  intelligenceRow: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  intelligenceCard: {
    backgroundColor: "#171B2B",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  intelHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  intelBadge: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  intelTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  intelHint: {
    color: "#8A8F9E",
    fontSize: 11,
  },
  emptyIntel: {
    backgroundColor: "#171B2B",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  emptyIntelText: {
    color: "#5A5F7A",
    fontSize: 13,
    textAlign: "center",
  },
  mapWrapper: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleNoMargin: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  aiActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A75F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  aiActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  transferPath: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 6,
  },
  pathBranch: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  confidenceText: {
    marginLeft: "auto",
    color: "#8B8FA3",
    fontSize: 10,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 6,
  },
  statCard: {
    borderRadius: 10,
    padding: 10,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center", // Fix vertical alignment
  },
  statValue: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "500",
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 16,
  },
  actionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
  },
  actionCard: {
    minHeight: 70,
    justifyContent: "space-between",
    backgroundColor: "#171B2B", // The action card background exact match
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 13,
  },
  dupeBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.2)",
    overflow: "hidden",
  },
  dupeBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  dupeBannerText: {
    flex: 1,
    color: "#FF6B6B",
    fontSize: 13,
    fontWeight: "700",
  },
});
