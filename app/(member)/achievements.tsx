import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { supabase } from "../../src/api/supabase";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useTabBarStore } from "../../src/store/useTabBarStore";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at?: string;
  isEarned?: boolean;
}

export default function AchievementsScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const setTabBarVisible = useTabBarStore((state) => state.setVisible);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [isRoadmapVisible, setIsRoadmapVisible] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadBadges();
    }
  }, [profile?.id]);

  const toggleRoadmap = (visible: boolean) => {
    setIsRoadmapVisible(visible);
    setTabBarVisible(!visible);
  };

  const loadBadges = async () => {
    try {
      const { data: badgesData, error: badgesError } = await supabase
        .from("badges")
        .select("*");

      if (badgesError) throw badgesError;

      const { data: userBadgesData, error: userBadgesError } = await supabase
        .from("user_badges")
        .select("badge_id, earned_at")
        .eq("user_id", profile?.id);

      if (userBadgesError) throw userBadgesError;

      const mergedBadges = (badgesData as any[]).map((b) => {
        const earned = (userBadgesData as any[])?.find(
          (ub) => ub.badge_id === b.id,
        );
        return {
          ...b,
          earned_at: earned?.earned_at,
        };
      });

      setAllBadges(mergedBadges as Badge[]);
    } catch (err) {
      console.error("Error loading badges:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = ({ item, index }: { item: Badge; index: number }) => {
    const isEarned = !!item.earned_at;

    return (
      <TouchableOpacity
        style={[styles.badgeCard, !isEarned && styles.lockedBadge]}
        onPress={() => {
          setSelectedBadge({ ...item, isEarned });
          toggleRoadmap(true);
        }}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={
            isEarned
              ? ["rgba(58, 117, 242, 0.12)", "rgba(139, 92, 246, 0.08)"]
              : ["rgba(31, 41, 55, 0.4)", "rgba(17, 24, 39, 0.4)"]
          }
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isEarned
                ? "rgba(245, 158, 11, 0.12)"
                : "rgba(75, 85, 99, 0.15)",
            },
          ]}
        >
          <Ionicons
            name={item.icon as any}
            size={36}
            color={isEarned ? "#FBBF24" : "#64748B"}
          />
          {!isEarned && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={12} color="#94A3B8" />
            </View>
          )}
        </View>
        <Text style={[styles.badgeName, !isEarned && styles.lockedText]}>
          {item.name}
        </Text>
        <Text
          style={[styles.badgeDesc, !isEarned && { color: "#64748B" }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
        {isEarned && (
          <View style={styles.earnedTag}>
            <Ionicons name="shield-checkmark" size={12} color="#10B981" />
            <Text style={styles.earnedText}>ĐÃ ĐẠT</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const earnedCount = allBadges.filter((b) => b.earned_at).length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#090E17", "#121927"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Huy hiệu & Thành tựu</Text>
          <Text style={styles.headerSubtitle}>Khám phá cột mốc của bạn</Text>
        </View>
      </View>

      <View style={styles.summarySection}>
        <LinearGradient
          colors={["rgba(31, 41, 55, 0.6)", "rgba(17, 24, 39, 0.6)"]}
          style={styles.summaryCardGradient}
        >
          <View style={styles.summaryInfo}>
            <View>
              <Text style={styles.summaryLabel}>TIẾN TRÌNH THÀNH TỰU</Text>
              <Text style={styles.summarySubtext}>
                Hãy tiếp tục mượn & đọc sách
              </Text>
            </View>
            <View style={styles.summaryValueContainer}>
              <Text style={styles.summaryValue}>{earnedCount}</Text>
              <Text style={styles.summaryValueTotal}>/{allBadges.length}</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={["#3B82F6", "#8B5CF6"]}
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.max(4, (earnedCount / (allBadges.length || 1)) * 100)}%`,
                },
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
        </LinearGradient>
      </View>

      <FlatList
        data={allBadges}
        renderItem={renderBadge}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyText}>
              Đang cập nhật hệ thống huy hiệu...
            </Text>
          )
        }
      />

      {/* Achievement Roadmap Modal */}
      <Modal
        visible={isRoadmapVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => toggleRoadmap(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedBadge && (
              <>
                <View style={styles.modalHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <View
                      style={[
                        styles.badgeIconCircle,
                        {
                          backgroundColor: selectedBadge.isEarned
                            ? "rgba(245, 158, 11, 0.18)"
                            : "rgba(75, 85, 99, 0.15)",
                        },
                      ]}
                    >
                      <Ionicons
                        name={(selectedBadge.icon as any) || "trophy"}
                        size={28}
                        color={selectedBadge.isEarned ? "#FBBF24" : "#64748B"}
                      />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>
                        {selectedBadge.name}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: selectedBadge.isEarned
                              ? "rgba(16, 185, 129, 0.12)"
                              : "rgba(245, 158, 11, 0.12)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: selectedBadge.isEarned
                                ? "#10B981"
                                : "#FBBF24",
                            },
                          ]}
                        >
                          {selectedBadge.isEarned
                            ? "ĐÃ ĐẠT ĐƯỢC"
                            : "ĐANG TIẾN HÀNH"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleRoadmap(false)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.roadmapBox}>
                    <Text style={styles.roadmapSectionTitle}>
                      LỘ TRÌNH ĐẠT ĐƯỢC
                    </Text>

                    {/* Step 1 */}
                    <View style={styles.roadmapStepRow}>
                      <View style={styles.stepIndicatorCol}>
                        <LinearGradient
                          colors={["#10B981", "#059669"]}
                          style={[styles.stepDot, { borderColor: "#10B981" }]}
                        >
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color="#FFFFFF"
                          />
                        </LinearGradient>
                        <View
                          style={[
                            styles.stepLine,
                            { backgroundColor: "#10B981" },
                          ]}
                        />
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text style={[styles.stepTitle, { color: "#10B981" }]}>
                          Bước 1: Khám phá thư viện
                        </Text>
                        <Text style={styles.stepDesc}>
                          Tạo tài khoản và xem qua kho sách phong phú
                        </Text>
                      </View>
                    </View>

                    {/* Step 2 */}
                    <View style={styles.roadmapStepRow}>
                      <View style={styles.stepIndicatorCol}>
                        <LinearGradient
                          colors={
                            selectedBadge.isEarned
                              ? ["#10B981", "#059669"]
                              : ["#3B82F6", "#1D4ED8"]
                          }
                          style={[
                            styles.stepDot,
                            {
                              borderColor: selectedBadge.isEarned
                                ? "#10B981"
                                : "#3B82F6",
                            },
                          ]}
                        >
                          {selectedBadge.isEarned ? (
                            <Ionicons
                              name="checkmark"
                              size={12}
                              color="#FFFFFF"
                            />
                          ) : (
                            <Text style={styles.stepNumberText}>2</Text>
                          )}
                        </LinearGradient>
                        <View
                          style={[
                            styles.stepLine,
                            {
                              backgroundColor: selectedBadge.isEarned
                                ? "#10B981"
                                : "#1F2937",
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text
                          style={[
                            styles.stepTitle,
                            !selectedBadge.isEarned && styles.stepTitleActive,
                            selectedBadge.isEarned && { color: "#10B981" },
                          ]}
                        >
                          Bước 2: Hoạt động & tích lũy XP
                        </Text>
                        <Text style={styles.stepDesc}>
                          Thực hiện mượn sách, đọc sách hoặc nghe sách nói
                        </Text>
                      </View>
                    </View>

                    {/* Step 3 */}
                    <View style={[styles.roadmapStepRow, { marginBottom: 0 }]}>
                      <View style={styles.stepIndicatorCol}>
                        {selectedBadge.isEarned ? (
                          <LinearGradient
                            colors={["#10B981", "#059669"]}
                            style={styles.stepDot}
                          >
                            <Ionicons
                              name="checkmark"
                              size={12}
                              color="#FFFFFF"
                            />
                          </LinearGradient>
                        ) : (
                          <View
                            style={[
                              styles.stepDot,
                              {
                                borderColor: "#374151",
                                backgroundColor: "#111827",
                              },
                            ]}
                          >
                            <Ionicons
                              name="lock-closed"
                              size={11}
                              color="#6B7280"
                            />
                          </View>
                        )}
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text
                          style={[
                            styles.stepTitle,
                            selectedBadge.isEarned
                              ? { color: "#10B981" }
                              : styles.stepTitleUpcoming,
                          ]}
                        >
                          Bước 3: Hoàn thành nhiệm vụ
                        </Text>
                        <Text style={styles.stepDesc}>
                          "{selectedBadge.description}"
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {selectedBadge.isEarned ? (
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      Share.share({
                        message: `Tôi vừa đạt được huy hiệu "${selectedBadge.name}" tại BiblioTech! 🏆\n"${selectedBadge.description}"`,
                        title: "Huy hiệu BiblioTech",
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#10B981", "#059669"]}
                      style={styles.btnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons
                        name="share-social"
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.saveBtnText}>Chia sẻ thành tích</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      toggleRoadmap(false);
                      router.push("/(member)" as any);
                    }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      style={styles.btnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons
                        name="book"
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.saveBtnText}>
                        Khám phá kho sách ngay
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090E17" },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "web" ? 30 : 60,
    paddingBottom: 20,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(31, 41, 55, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.4)",
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
  },
  summarySection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCardGradient: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.4)",
    overflow: "hidden",
  },
  summaryInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  summarySubtext: {
    fontSize: 13,
    color: "#CBD5E1",
    fontWeight: "500",
    marginTop: 2,
  },
  summaryValueContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#3B82F6",
    lineHeight: 34,
  },
  summaryValueTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
    marginLeft: 2,
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(31, 41, 55, 0.8)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  badgeCard: {
    flex: 1,
    margin: 8,
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(55, 65, 81, 0.5)",
    overflow: "hidden",
    minHeight: 184,
    justifyContent: "space-between",
  },
  lockedBadge: {
    opacity: 0.55,
  },
  iconContainer: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  lockOverlay: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#1E293B",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#090E17",
  },
  badgeName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  lockedText: {
    color: "#64748B",
  },
  badgeDesc: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 6,
  },
  earnedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  earnedText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  emptyText: {
    color: "#64748B",
    textAlign: "center",
    marginTop: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(9, 14, 23, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: "#1F2937",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(55, 65, 81, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.8,
  },
  modalBody: {
    marginBottom: 24,
  },
  badgeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  roadmapBox: {
    backgroundColor: "#1F2937",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#374151",
    padding: 20,
  },
  roadmapSectionTitle: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 16,
    letterSpacing: 0.8,
  },
  roadmapStepRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  stepIndicatorCol: {
    alignItems: "center",
    marginRight: 16,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  stepContentCol: {
    flex: 1,
    paddingTop: 3,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  stepTitleActive: {
    color: "#FFFFFF",
  },
  stepTitleUpcoming: {
    color: "#4B5563",
  },
  stepDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 18,
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  saveBtn: {
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  btnGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
