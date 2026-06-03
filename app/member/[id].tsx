import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/api/supabase";
import { DigitalMembershipPass } from "../../src/features/members/components/DigitalMembershipPass";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

export default function SharedMemberPassScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();
        if (!error && data) {
          setMemberProfile(data);
        }
      } catch (err) {
        console.error("[SharedPass] Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A75F2" />
        <Text style={styles.loadingText}>{t('common.loading_card', 'Đang tải thẻ thành viên...')}</Text>
      </View>
    );
  }

  if (!memberProfile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{t('common.card_not_found', 'Không tìm thấy thông tin thẻ thành viên')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push("/")}>
          <Text style={styles.backBtnText}>{t('common.back_home', 'Quay lại trang chủ')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#0D111D", "#080B11"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Decoration */}
        <View style={styles.header}>
          <View style={styles.brandBadge}>
            <Ionicons name="sparkles" size={12} color="#60A5FA" style={{ marginRight: 4 }} />
            <Text style={styles.brandBadgeText}>{t('member.card_update', 'BẢN TIN CẬP NHẬT')}</Text>
          </View>
          <Text style={styles.headerTitle}>BiblioTech Premium</Text>
          <Text style={styles.headerSubtitle}>{t('member.smart_membership_card', 'Thẻ thành viên điện tử thông minh')}</Text>
        </View>

        {/* Card display wrapper */}
        <View style={styles.cardWrapper}>
          <DigitalMembershipPass
            member={{
              id: memberProfile.id || "GUEST",
              fullName: memberProfile.fullName || memberProfile.full_name || t('common.member', 'Thành viên'),
              level: memberProfile.level || 1,
              xp: memberProfile.xp || 0,
            }}
          />
        </View>

        {/* Info Card / Action Card */}
        <View style={styles.benefitsCard}>
          <View style={styles.benefitRow}>
            <View style={styles.benefitIconWrapper}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            </View>
            <View style={styles.benefitTextCol}>
              <Text style={styles.benefitTitle}>{t('member.benefit_verified_account', 'Tài khoản chính chủ')}</Text>
              <Text style={styles.benefitDesc}>{t('member.benefit_verified_desc', 'Thành viên sở hữu thẻ này có quyền truy cập toàn bộ kho tài liệu của BiblioTech.')}</Text>
            </View>
          </View>

          <View style={[styles.benefitRow, { borderBottomWidth: 0 }]}>
            <View style={styles.benefitIconWrapper}>
              <Ionicons name="gift" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.benefitTextCol}>
              <Text style={styles.benefitTitle}>{t('member.benefit_premium_perks', 'Quyền lợi hội viên Premium')}</Text>
              <Text style={styles.benefitDesc}>{t('member.benefit_premium_desc', 'Hỗ trợ đọc sách không giới hạn, tích lũy XP tăng cấp độ mỗi ngày.')}</Text>
            </View>
          </View>
        </View>

        {/* Dynamic call to action */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push("/")}
          accessibilityRole="button"
          accessibilityLabel={t('common.experience_now', 'Trải nghiệm ngay')}
        >
          <LinearGradient
            colors={["#3A75F2", "#2B5CD4"]}
            style={styles.gradientCta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="rocket-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.ctaButtonText}>{t('member.join_now', 'Tham gia BiblioTech ngay')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Extra Footer */}
        <Text style={styles.footerText}>
          {t('common.platform_desc', 'BiblioTech Platform • Trải nghiệm mượn sách & đọc sách số 1')}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "web" ? 60 : 40,
    paddingBottom: 40,
    minHeight: "100%",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B0F19",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#8A8F9E",
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0B0F19",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(58, 117, 242, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(58, 117, 242, 0.3)",
    marginBottom: 12,
  },
  brandBadgeText: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: "#7E859A",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "500",
  },
  cardWrapper: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  benefitsCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 28,
  },
  benefitRow: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },
  benefitIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  benefitTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  benefitTitle: {
    color: "#F3F4F6",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  benefitDesc: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 18,
  },
  ctaButton: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 18,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  gradientCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1F263B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D374D",
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  footerText: {
    color: "#4B5563",
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
});
