import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import { LineChart, PieChart } from "react-native-chart-kit";
import { supabase } from "../../src/api/supabase";
import { DigitalMembershipPass } from "../../src/features/members/components/DigitalMembershipPass";
import { OfflineCard } from "../../src/features/members/components/OfflineCard";
import { useLibrary } from "../../src/hooks/useLibrary";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useUndoStore } from "../../src/store/useUndoStore";
import { useTabBarStore } from "../../src/store/useTabBarStore";
import { InlineUndoButton } from "../../src/components/InlineUndoButton";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const profile = useAuthStore((state) => state.profile);
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const { borrows, books, gamification } = useLibrary();
  const { data: myBorrows, isLoading: loadingBorrows } = borrows.list();
  const { data: allBooks } = books.list();
  const { data: allBadges } = gamification.getBadges();
  const { data: myBadges } = gamification.getMyBadges();

  const getLocalizedBadgeName = (badgeName: string) => {
    const keyMap: { [key: string]: string } = {
      "Thính giả mới": "badge_new_listener",
      "Tập sự Đọc sách": "badge_novice_reader",
      "Nhà phê bình": "badge_critic",
      "Chiến thần Trả sách": "badge_return_champion",
      "Chuyên gia Sách nói": "badge_audiobook_expert",
      "Mọt sách Chính hiệu": "badge_true_bookworm",
      "Độc giả Trung thành": "badge_loyal_reader",
    };
    const key = keyMap[badgeName];
    return key ? t(`profile.${key}`) : badgeName;
  };

  const getLocalizedBadgeDesc = (badgeDesc: string) => {
    const keyMap: { [key: string]: string } = {
      "Bắt đầu nghe cuốn sách nói đầu tiên": "badge_desc_new_listener",
      "Bắt đầu hành trình với cuốn sách đầu": "badge_desc_novice_reader",
      "Để lại 5 đánh giá cho các đầu sách": "badge_desc_critic",
      "Trả sách đúng hạn 5 lần liên tiếp": "badge_desc_return_champion",
      "Hoàn thành việc nghe 5 cuốn sách nói": "badge_desc_audiobook_expert",
      "Mượn trên 10 cuốn sách": "badge_desc_true_bookworm",
      "Mượn trên 50 cuốn sách": "badge_desc_loyal_reader",
    };
    for (const [key, val] of Object.entries(keyMap)) {
      if (badgeDesc.includes(key)) return t(`profile.${val}`);
    }
    return badgeDesc;
  };

  const [isOfflineCardVisible, setIsOfflineCardVisible] = useState(false);

  const viewShotRef = React.useRef<ViewShot>(null);

  const handleShareCard = () => {
    setIsShareModalVisible(true);
  };

  const handleShareCardImage = async () => {
    try {
      if (Platform.OS === "web") {
        const loadHtml2Canvas = () => {
          return new Promise<any>((resolve, reject) => {
            if (typeof window !== "undefined" && (window as any).html2canvas) {
              resolve((window as any).html2canvas);
              return;
            }
            const script = document.createElement("script");
            script.src =
              "https://html2canvas.hertzen.com/dist/html2canvas.min.js";
            script.onload = () => resolve((window as any).html2canvas);
            script.onerror = reject;
            document.head.appendChild(script);
          });
        };

        const html2canvas = await loadHtml2Canvas();
        const element = document.getElementById("membership-card-web");
        if (element) {
          const canvas = await html2canvas(element, {
            useCORS: true,
            backgroundColor: "#0B0F1A",
          });
          const dataUrl = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = t("profile.download_filename", { name: profile?.fullName || "User" });
          link.click();
          Alert.alert(
            t("common.success"),
            t("profile.download_success"),
          );
          return;
        }
      }

      const uri = await captureRef(viewShotRef, {
        format: "png",
        quality: 0.8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t("common.error"), t("profile.share_error_not_available"));
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: t("profile.share_title_card"),
        UTI: "public.png",
      });
    } catch (error) {
      console.error("Sharing error:", error);
      Alert.alert(t("common.error"), t("profile.share_error_image"));
    }
  };

  const handleShareCardViaEmail = async () => {
    try {
      const subject = t("profile.share_email_subject");
      const body = t("profile.share_email_body", {
        id: profile?.id?.toUpperCase(),
        name: profile?.fullName,
        level: profile?.level,
      });

      const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        await Share.share({
          message: `${subject}\n\n${body}`,
          title: subject,
        });
      }
    } catch (error) {
      console.error("Email error:", error);
      Alert.alert(t("common.error"), t("profile.share_error_email"));
    }
  };

  const handleShareCardLink = async () => {
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:8081";
      const shareUrl = `${origin}/member/${profile?.id}`;
      const text = t("profile.share_link_message", {
        id: profile?.id?.toUpperCase(),
        url: shareUrl,
      });

      await Share.share({
        message: text,
        title: t("profile.share_title_card"),
      });
    } catch (error) {
      console.error("Share Link error:", error);
      Alert.alert(t("common.error"), t("profile.share_error_link"));
    }
  };

  const defaultGenres = [
    "Văn học",
    "Khoa học",
    "Lịch sử",
    "Công nghệ",
    "Nghệ thuật",
    "Kinh tế",
    "Kỹ năng",
    "Truyện tranh",
    "Tiểu thuyết",
    "Tâm lý",
    "Triết học",
    "Học ngoại ngữ",
  ];

  const allCategories = defaultGenres;

  const genreColorMap: Record<
    string,
    { bg: string; border: string; text: string }
  > = {
    "Văn học": {
      bg: "rgba(58, 117, 242, 0.15)",
      border: "rgba(58, 117, 242, 0.4)",
      text: "#60A5FA",
    },
    "Khoa học": {
      bg: "rgba(10, 185, 129, 0.15)",
      border: "rgba(10, 185, 129, 0.4)",
      text: "#34D399",
    },
    "Lịch sử": {
      bg: "rgba(245, 158, 11, 0.15)",
      border: "rgba(245, 158, 11, 0.4)",
      text: "#FBBF24",
    },
    "Công nghệ": {
      bg: "rgba(139, 92, 246, 0.15)",
      border: "rgba(139, 92, 246, 0.4)",
      text: "#A78BFA",
    },
    "Nghệ thuật": {
      bg: "rgba(236, 72, 153, 0.15)",
      border: "rgba(236, 72, 153, 0.4)",
      text: "#F472B6",
    },
    "Kinh tế": {
      bg: "rgba(14, 165, 233, 0.15)",
      border: "rgba(14, 165, 233, 0.4)",
      text: "#38BDF8",
    },
    "Kỹ năng": {
      bg: "rgba(239, 68, 68, 0.15)",
      border: "rgba(239, 68, 68, 0.4)",
      text: "#F87171",
    },
    "Truyện tranh": {
      bg: "rgba(244, 63, 94, 0.15)",
      border: "rgba(244, 63, 94, 0.4)",
      text: "#FB7185",
    },
    "Tiểu thuyết": {
      bg: "rgba(168, 85, 247, 0.15)",
      border: "rgba(168, 85, 247, 0.4)",
      text: "#C084FC",
    },
    "Tâm lý": {
      bg: "rgba(101, 163, 13, 0.15)",
      border: "rgba(101, 163, 13, 0.4)",
      text: "#A3E635",
    },
    "Triết học": {
      bg: "rgba(20, 184, 166, 0.15)",
      border: "rgba(20, 184, 166, 0.4)",
      text: "#2DD4BF",
    },
    "Học ngoại ngữ": {
      bg: "rgba(234, 179, 8, 0.15)",
      border: "rgba(234, 179, 8, 0.4)",
      text: "#FACC15",
    },
  };

  const getGenreStyle = (genre: string) => {
    return (
      genreColorMap[genre] || {
        bg: "rgba(58, 117, 242, 0.15)",
        border: "rgba(58, 117, 242, 0.3)",
        text: "#3A75F2",
      }
    );
  };

  const totalBorrowed = myBorrows?.length || 0;
  const activeBorrows =
    myBorrows?.filter((b: any) => b.status === "BORROWED").length || 0;
  const overdueCount =
    myBorrows?.filter(
      (b: any) =>
        b.status === "BORROWED" &&
        b.due_date &&
        new Date(b.due_date) < new Date(),
    ).length || 0;
  const totalFines =
    myBorrows?.reduce((acc: number, r: any) => acc + (r.fine_amount || 0), 0) ||
    0;

  // Monthly activity data is calculated via helper functions below

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      handleUpload(result.assets[0].base64, result.assets[0].uri);
    }
  };

  const handleUpload = async (base64: string, uri: string) => {
    if (!profile?.id) return;
    setUploading(true);
    try {
      const fileName = `${profile.id}_${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, decode(base64), {
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
        .eq("id", profile.id);

      if (updateError) throw updateError;

      updateProfile({ avatarUrl: publicUrl } as any);
      Alert.alert(t("common.success"), t("profile.avatar_update_success"));
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);
  const [isRoadmapVisible, setIsRoadmapVisible] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAvatarSheetVisible, setIsAvatarSheetVisible] = useState(false);
  const [isAvatarPreviewVisible, setIsAvatarPreviewVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  const setTabBarVisible = useTabBarStore((state) => state.setVisible);

  React.useEffect(() => {
    const isAnyModalVisible =
      isOfflineCardVisible ||
      isEditModalVisible ||
      isRoadmapVisible ||
      isAvatarSheetVisible ||
      isAvatarPreviewVisible ||
      isShareModalVisible;
    setTabBarVisible(!isAnyModalVisible);

    return () => {
      setTabBarVisible(true);
    };
  }, [
    isOfflineCardVisible,
    isEditModalVisible,
    isRoadmapVisible,
    isAvatarSheetVisible,
    isAvatarPreviewVisible,
    isShareModalVisible,
  ]);

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        t("profile.camera_permission_title", "Quyền truy cập"),
        t(
          "profile.camera_permission_desc",
          "Vui lòng cấp quyền truy cập máy ảnh để chụp ảnh mới",
        ),
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]?.base64) {
      handleUpload(result.assets[0].base64, result.assets[0].uri);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.id) return;
    setUploading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profile.id);

      if (error) throw error;

      updateProfile({ avatarUrl: "" } as any);
      Alert.alert(t("common.success"), t("profile.avatar_remove_success"));
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          bio: editBio,
          favorite_genres: editGenres,
        })
        .eq("id", profile.id);

      if (error) throw error;

      updateProfile({ bio: editBio, favoriteGenres: editGenres });
      setIsEditModalVisible(false);
      Alert.alert(t("common.success"), t("profile.profile_update_success"));
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("profile.profile_update_error"),
      );
    } finally {
      setSaving(false);
    }
  };

  const chartConfig = {
    backgroundGradientFrom: "#171B2B",
    backgroundGradientTo: "#171B2B",
    color: (opacity = 1) => `rgba(58, 117, 242, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(138, 143, 158, ${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 10,
    },
  };

  const genres = allCategories;
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    profile?.favoriteGenres || [],
  );

  React.useEffect(() => {
    if (profile?.favoriteGenres) {
      setSelectedGenres(profile.favoriteGenres);
    }
  }, [profile?.favoriteGenres]);

  const toggleGenre = async (genre: string) => {
    const newGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre];

    setSelectedGenres(newGenres);
    updateProfile({ favoriteGenres: newGenres });

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ favorite_genres: newGenres })
        .eq("id", profile?.id);

      if (error) throw error;
    } catch (e) {
      console.error("Error saving genres:", e);
    }
  };

  const clearAllGenres = async () => {
    const previousGenres = [...selectedGenres];

    useUndoStore.getState().queueAction({
      message: t("admin.clear_genres_pending"),
      onCommit: async () => {
        try {
          const { error } = await supabase
            .from("profiles")
            .update({ favorite_genres: [] })
            .eq("id", profile?.id);
          if (error) throw error;
        } catch (e) {
          console.error("Error clearing genres:", e);
          // Revert UI on failure
          setSelectedGenres(previousGenres);
          updateProfile({ favoriteGenres: previousGenres });
          throw e;
        }
      },
      onUndo: () => {
        setSelectedGenres(previousGenres);
        updateProfile({ favoriteGenres: previousGenres });
      },
    });

    // Optimistic Update
    setSelectedGenres([]);
    updateProfile({ favoriteGenres: [] });
  };

  // Data processing for charts
  const getMonthlyStats = () => {
    const months = [
      t("months.jan", "Th1"),
      t("months.feb", "Th2"),
      t("months.mar", "Th3"),
      t("months.apr", "Th4"),
      t("months.may", "Th5"),
      t("months.jun", "Th6"),
    ];
    const data = [0, 0, 0, 0, 0, 0]; // Mock for now, or derive from myBorrows
    if (myBorrows) {
      myBorrows.forEach((b: any) => {
        const month = new Date(b.borrow_date).getMonth();
        if (month < 6) data[month]++;
      });
    }
    return { labels: months, datasets: [{ data }] };
  };

  const getGenreStats = () => {
    const genreCounts: Record<string, number> = {};
    myBorrows?.forEach((b: any) => {
      const book = allBooks?.find(
        (bk: any) => (bk.id || bk.isbn) === b.book_id,
      );
      const genre = book?.category || t("common.other");
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });

    const colors = [
      "#3A75F2",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
    ];
    return Object.entries(genreCounts).map(([name, population], i) => ({
      name,
      population,
      color: colors[i % colors.length],
      legendFontColor: "#8A8F9E",
      legendFontSize: 12,
    }));
  };

  const monthlyData = getMonthlyStats();
  const pieData = getGenreStats();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <LinearGradient
          colors={["#1E2540", "#0F121D"]}
          style={styles.profileHeader}
          accessibilityRole="header"
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setIsAvatarSheetVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("common.edit")}
          >
            <Image
              source={{
                uri:
                  profile?.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${profile?.fullName || "User"}&background=3A75F2&color=fff`,
              }}
              style={styles.avatar}
              accessibilityRole="image"
              accessibilityLabel={`Avatar: ${profile?.fullName}`}
            />
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => setIsAvatarSheetVisible(true)}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={t("common.edit")}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </TouchableOpacity>

          <Text style={styles.userName} accessibilityRole="header">
            {profile?.fullName || t("roles.member")}
          </Text>
          {profile?.favoriteGenres && profile.favoriteGenres.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 6,
                marginTop: 6,
                marginBottom: 4,
              }}
            >
              {profile.favoriteGenres.map((genre, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: "rgba(58, 117, 242, 0.15)",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "500",
                    }}
                  >
                    {t(`categories.${genre}`, genre)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {profile?.bio ? (
            <Text style={styles.userBio} numberOfLines={2}>
              {profile.bio}
            </Text>
          ) : (
            <Text style={[styles.userBio, { opacity: 0.5 }]}>
              {t("profile.no_bio")}
            </Text>
          )}

          {/* Level and XP Bar */}
          <View
            style={styles.levelContainer}
            accessible={true}
            accessibilityLabel={t(
              "profile.level_xp_info",
              "Cấp độ {{level}}, kinh nghiệm {{xp}} điểm",
              { level: profile?.level || 1, xp: profile?.xp || 0 },
            )}
          >
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>
                {t("profile.level_short").toUpperCase()}{" "}
                {profile?.level || 1}
              </Text>
            </View>
            <View style={styles.xpBarContainer}>
              <View style={styles.xpBarBg}>
                <View
                  style={[
                    styles.xpBarFill,
                    { width: `${Math.min((profile?.xp || 0) % 100, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.xpText}>{profile?.xp || 0} XP</Text>
            </View>
            <TouchableOpacity
              style={styles.shareProfileBtn}
              onPress={() => {
                Share.share({
                  message: t("profile.share_message", { level: profile?.level || 1, xp: profile?.xp || 0 }),
                  title: t("profile.share_title"),
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={t(
                "profile.share_achievement",
                "Chia sẻ thành tích",
              )}
            >
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.headerActions}>
            <View
              style={styles.roleBadge}
              accessibilityLabel={`Vai trò: ${profile?.role ? t(`roles.${profile.role.toLowerCase()}`) : ""}`}
            >
              <Text style={styles.roleText}>
                {profile?.role
                  ? t(`roles.${profile.role.toLowerCase()}`)?.toUpperCase()
                  : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setEditBio(profile?.bio || "");
                setEditGenres(profile?.favoriteGenres || []);
                setIsEditModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("profile.edit_profile")}
            >
              <Ionicons name="pencil" size={14} color="#3A75F2" />
              <Text style={styles.editBtnText}>
                {t("profile.edit_profile")}
              </Text>
            </TouchableOpacity>
          </View>
          <Text
            style={styles.userId}
            accessibilityLabel={`${t("profile.id")}: ${profile?.id}`}
          >
            {t("profile.id")}: {profile?.id.substring(0, 8).toUpperCase()}
          </Text>
        </LinearGradient>

        {/* Favorite Genres Section */}
        <View style={styles.section}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={styles.sectionTitle}>
              {t("profile.my_interests", "Thể loại yêu thích")}
            </Text>
            {selectedGenres.length > 0 && (
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.25)",
                }}
                onPress={clearAllGenres}
              >
                <Ionicons
                  name="trash-outline"
                  size={13}
                  color="#EF4444"
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={{
                    color: "#EF4444",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {t("profile.clear_all", "Xóa tất cả")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.genreChips}>
            {allCategories.map((genre, idx) => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleGenre(genre)}
                  style={[
                    styles.genreChip,
                    {
                      backgroundColor: isSelected
                        ? "rgba(16, 185, 129, 0.15)"
                        : "#171B2B",
                      borderColor: isSelected ? "#10B981" : "#1F263B",
                      borderWidth: isSelected ? 1.5 : 1,
                      shadowColor: isSelected ? "#10B981" : "transparent",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isSelected ? 0.15 : 0,
                      shadowRadius: 4,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.genreChipText,
                      {
                        color: isSelected ? "#10B981" : "#8A8F9E",
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {t(`categories.${genre}`, genre)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Digital Membership Card Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("member.digital_pass")}</Text>

          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.8 }}>
            <View
              id="membership-card-web"
              nativeID="membership-card-web"
              style={{
                alignSelf: "center",
                width: Math.min(width * 0.85, 420),
                height: Math.min(width * 0.85, 420) * 0.62,
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <DigitalMembershipPass
                member={{
                  id: profile?.id || "GUEST",
                  fullName: profile?.fullName || "Thành viên",
                  level: profile?.level || 1,
                  xp: profile?.xp || 0,
                }}
              />
            </View>
          </ViewShot>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.shareCardBtn}
              onPress={handleShareCard}
            >
              <Ionicons name="share-social" size={18} color="#3A75F2" />
              <Text style={styles.shareCardBtnText}>
                {t("profile.share_card")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.offlineAccessBtn}
              onPress={() => setIsOfflineCardVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("profile.offline_card")}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.offlineAccessText}>
                {t("profile.offline_card")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <OfflineCard
          visible={isOfflineCardVisible}
          onClose={() => setIsOfflineCardVisible(false)}
          profile={profile}
        />

        {/* Share Card Modal */}
        <Modal
          visible={isShareModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsShareModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.shareCardModalOverlay}
            activeOpacity={1}
            onPress={() => setIsShareModalVisible(false)}
          >
            <View
              style={styles.shareMenuModalContent}
              onStartShouldSetResponder={() => true}
            >
              <View style={[styles.modalHeader, { marginBottom: 16 }]}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={styles.shareIconCircle}>
                    <Ionicons name="share-social" size={22} color="#3A75F2" />
                  </View>
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
                    ]}
                  >
                    {t("profile.share_pass_title")}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setIsShareModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#8A8F9E" />
                </TouchableOpacity>
              </View>

              <Text style={styles.shareDesc}>
                {t("profile.share_pass_subtitle")}
              </Text>

              <View style={styles.shareOptionList}>
                <TouchableOpacity
                  style={styles.shareOptionItem}
                  onPress={async () => {
                    setIsShareModalVisible(false);
                    setTimeout(() => {
                      handleShareCardLink();
                    }, 300);
                  }}
                >
                  <View
                    style={[
                      styles.shareOptionIcon,
                      { backgroundColor: "#3A75F2" },
                    ]}
                  >
                    <Ionicons name="link" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.shareOptionTextCol}>
                    <Text style={styles.shareOptionTitle}>
                      {t("profile.create_share_link")}
                    </Text>
                    <Text style={styles.shareOptionSubtitle}>
                      {t("profile.create_share_link_desc")}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareOptionItem}
                  onPress={async () => {
                    setIsShareModalVisible(false);
                    setTimeout(() => {
                      handleShareCardViaEmail();
                    }, 300);
                  }}
                >
                  <View
                    style={[
                      styles.shareOptionIcon,
                      { backgroundColor: "#10B981" },
                    ]}
                  >
                    <Ionicons name="mail" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.shareOptionTextCol}>
                    <Text style={styles.shareOptionTitle}>
                      {t("profile.share_via_email")}
                    </Text>
                    <Text style={styles.shareOptionSubtitle}>
                      {t("profile.share_via_email_desc")}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareOptionItem}
                  onPress={async () => {
                    setIsShareModalVisible(false);
                    setTimeout(() => {
                      handleShareCardImage();
                    }, 300);
                  }}
                >
                  <View
                    style={[
                      styles.shareOptionIcon,
                      { backgroundColor: "#F59E0B" },
                    ]}
                  >
                    <Ionicons name="image" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.shareOptionTextCol}>
                    <Text style={styles.shareOptionTitle}>
                      {t("profile.share_image")}
                    </Text>
                    <Text style={styles.shareOptionSubtitle}>
                      {t("profile.share_image_desc")}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statItem, { backgroundColor: "#3A75F2" }]}>
            <Ionicons name="book" size={20} color="#FFFFFF" />
            <Text style={styles.statVal}>{totalBorrowed}</Text>
            <Text style={styles.statLab}>{t("profile.total_borrows")}</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: "#10B981" }]}>
            <Ionicons name="bookmark" size={20} color="#FFFFFF" />
            <Text style={styles.statVal}>{activeBorrows}</Text>
            <Text style={styles.statLab}>{t("profile.active_borrows")}</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: "#F59E0B" }]}>
            <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
            <Text style={styles.statVal}>{overdueCount}</Text>
            <Text style={styles.statLab}>{t("profile.overdue")}</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: "#EF4444" }]}>
            <Ionicons name="wallet" size={20} color="#FFFFFF" />
            <Text style={styles.statVal}>{totalFines.toLocaleString()}đ</Text>
            <Text style={styles.statLab}>{t("profile.total_fine")}</Text>
          </View>
        </View>

        {/* Reading Analytics Charts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("profile.reading_journey", "Hành trình đọc sách")}
          </Text>

          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>
              {t("profile.monthly_activity", "Hoạt động hàng tháng")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ paddingRight: 20 }}>
                <LineChart
                  data={monthlyData}
                  width={width - 80}
                  height={180}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                />
              </View>
            </ScrollView>
          </View>

          <View style={[styles.chartContainer, { marginTop: 20 }]}>
            <Text style={styles.chartTitle}>
              {t("profile.genre_distribution", "Phân bổ thể loại")}
            </Text>
            <PieChart
              data={pieData}
              width={width - 48}
              height={180}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        </View>

        {/* Achievement Badges Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t("profile.badges")}</Text>
            <Text style={styles.badgeCountText}>
              {myBadges?.length || 0}/{allBadges?.length || 0}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.badgeList}
          >
            {allBadges?.map((badge: any) => {
              const isEarned = myBadges?.some(
                (mb: any) => mb.id === badge.id || mb.badge_id === badge.id,
              );
              return (
                <TouchableOpacity
                  key={badge.id}
                  style={[
                    styles.badgeItemCard,
                    isEarned
                      ? styles.activeBadgeCard
                      : styles.inactiveBadgeCard,
                  ]}
                  onPress={() => {
                    setSelectedBadge({ ...badge, isEarned });
                    setIsRoadmapVisible(true);
                  }}
                  accessible={true}
                  accessibilityLabel={
                    i18n.language === "en"
                      ? `Badge ${getLocalizedBadgeName(badge.name)}: ${getLocalizedBadgeDesc(badge.description)}. Status: ${isEarned ? "Earned" : "In progress"}`
                      : `Huy hiệu ${badge.name}: ${badge.description}. Trạng thái: ${isEarned ? "Đã đạt" : "Chưa đạt"}`
                  }
                >
                  <View style={styles.badgeIconContainer}>
                    <View
                      style={[
                        styles.badgeIconCircle,
                        {
                          backgroundColor: isEarned
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(255,255,255,0.05)",
                        },
                      ]}
                    >
                      <Ionicons
                        name={(badge.icon as any) || "trophy"}
                        size={28}
                        color={isEarned ? "#F59E0B" : "#3D4260"}
                      />
                    </View>
                    {isEarned && (
                      <View style={styles.shareBadgeBadge}>
                        <Ionicons name="share-social" size={10} color="white" />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.badgeName,
                      isEarned && styles.activeBadgeName,
                    ]}
                  >
                    {getLocalizedBadgeName(badge.name)}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>
                    {getLocalizedBadgeDesc(badge.description)}
                  </Text>
                  {isEarned && (
                    <View style={styles.earnedCheck}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#10B981"
                      />
                      <Text style={styles.earnedText}>
                        {t("profile.earned", "Đã đạt")}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Analytics Entry Point */}
        <TouchableOpacity
          style={styles.analyticsCard}
          onPress={() => router.push("/(member)/analytics" as any)}
        >
          <LinearGradient
            colors={["#3A75F2", "#1E40AF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.analyticsGradient}
          >
            <View style={styles.analyticsInfo}>
              <Text style={styles.analyticsTitle}>
                {t("profile.analytics_title", "Phân tích đọc sách")}
              </Text>
              <Text style={styles.analyticsDesc}>
                {t(
                  "profile.analytics_desc",
                  "Xem xu hướng mượn sách, biểu đồ thể loại và nhật ký hoạt động của bạn",
                )}
              </Text>
            </View>
            <View style={styles.analyticsIconBox}>
              <Ionicons name="bar-chart" size={24} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Actions Section */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/settings" as any)}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="settings-outline" size={20} color="#3A75F2" />
            </View>
            <Text style={styles.actionLabel}>{t("config.system_config")}</Text>
            <Ionicons name="chevron-forward" size={18} color="#5A5F7A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(member)/history")}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: "rgba(16, 185, 129, 0.1)" },
              ]}
            >
              <Ionicons name="time-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.actionLabel}>
              {t("profile.borrow_history")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#5A5F7A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push("/(member)/community")}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: "rgba(139, 92, 246, 0.1)" },
              ]}
            >
              <Ionicons name="people-outline" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.actionLabel}>
              {t("tabs.community")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#5A5F7A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => {
              setSelectedBadge(null);
              setIsRoadmapVisible(true);
            }}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: "rgba(245, 158, 11, 0.1)" },
              ]}
            >
              <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.actionLabel}>
              {t("profile.badges")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#5A5F7A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, { marginTop: 20 }]}
            onPress={logout}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: "rgba(239, 68, 68, 0.1)" },
              ]}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.actionLabel, { color: "#EF4444" }]}>
              {t("common.logout")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("profile.edit_profile")}</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <Text style={styles.inputLabel}>
                  {t("profile.favorite_genres_label")}
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.25)",
                  }}
                  onPress={() => {
                    const previousGenres = [...editGenres];
                    useUndoStore.getState().queueAction({
                      message: t("admin.clear_genres_pending"),
                      onCommit: async () => {
                        // Commit: No specific commit needed as state is saved on handleSaveProfile
                      },
                      onUndo: () => {
                        setEditGenres(previousGenres);
                      },
                    });
                    setEditGenres([]);
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={13}
                    color="#EF4444"
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={{
                      color: "#EF4444",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    {t("profile.clear_all", "Xóa tất cả")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputSubLabel}>
                {t("profile.choose_genres_desc")}
              </Text>
              <View style={styles.genreSelector}>
                {allCategories.map((genre) => {
                  const isSelected = editGenres.includes(genre);
                  return (
                    <TouchableOpacity
                      key={genre}
                      style={[
                        styles.genreOption,
                        isSelected && {
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          borderColor: "#10B981",
                          borderWidth: 1.5,
                          shadowColor: "#10B981",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.15,
                          shadowRadius: 4,
                        },
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          setEditGenres(editGenres.filter((g) => g !== genre));
                        } else {
                          setEditGenres([...editGenres, genre]);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.genreOptionText,
                          isSelected && {
                            color: "#10B981",
                            fontWeight: "bold",
                          },
                        ]}
                      >
                        {t(`categories.${genre}`, genre)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 20 }]}>
                {t("profile.bio_label")}
              </Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder={t("profile.bio_placeholder")}
                placeholderTextColor="#5A5F7A"
                value={editBio}
                onChangeText={setEditBio}
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {t("profile.save_changes")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Achievement Roadmap Modal */}
      <Modal
        visible={isRoadmapVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsRoadmapVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { maxHeight: "85%", borderTopWidth: 1, borderColor: "#1F263B" },
            ]}
          >
            {selectedBadge && (
              <>
                <View style={styles.modalHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={[
                        styles.badgeIconCircle,
                        {
                          width: 50,
                          height: 50,
                          borderRadius: 25,
                          backgroundColor: selectedBadge.isEarned
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(255,255,255,0.05)",
                          marginBottom: 0,
                        },
                      ]}
                    >
                      <Ionicons
                        name={(selectedBadge.icon as any) || "trophy"}
                        size={24}
                        color={selectedBadge.isEarned ? "#F59E0B" : "#3D4260"}
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.modalTitle,
                          { fontSize: 18, marginBottom: 2 },
                        ]}
                      >
                        {getLocalizedBadgeName(selectedBadge.name)}
                      </Text>
                      <Text
                        style={{
                          color: selectedBadge.isEarned ? "#10B981" : "#F59E0B",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        {selectedBadge.isEarned
                          ? t("profile.badge_earned")
                          : t("profile.badge_in_progress")}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setIsRoadmapVisible(false)}>
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.roadmapBox}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { color: "#8A8F9E", fontSize: 13, marginBottom: 12 },
                      ]}
                    >
                      {t("profile.roadmap")}
                    </Text>

                    {/* Step 1 */}
                    <View style={styles.roadmapStepRow}>
                      <View style={styles.stepIndicatorCol}>
                        <View style={[styles.stepDot, styles.stepDotCompleted]}>
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                        <View
                          style={[styles.stepLine, styles.stepLineCompleted]}
                        />
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text style={styles.stepTitle}>
                          {t("profile.step1")}
                        </Text>
                        <Text style={styles.stepDesc}>
                          {t("profile.step1_desc")}
                        </Text>
                      </View>
                    </View>

                    {/* Step 2 */}
                    <View style={styles.roadmapStepRow}>
                      <View style={styles.stepIndicatorCol}>
                        <View
                          style={[
                            styles.stepDot,
                            selectedBadge.isEarned
                              ? styles.stepDotCompleted
                              : styles.stepDotActive,
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
                        </View>
                        <View
                          style={[
                            styles.stepLine,
                            selectedBadge.isEarned && styles.stepLineCompleted,
                          ]}
                        />
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text
                          style={[
                            styles.stepTitle,
                            !selectedBadge.isEarned && styles.stepTitleActive,
                          ]}
                        >
                          {t("profile.step2")}
                        </Text>
                        <Text style={styles.stepDesc}>
                          {t("profile.step2_desc")}
                        </Text>
                      </View>
                    </View>

                    {/* Step 3 */}
                    <View style={[styles.roadmapStepRow, { marginBottom: 0 }]}>
                      <View style={styles.stepIndicatorCol}>
                        <View
                          style={[
                            styles.stepDot,
                            selectedBadge.isEarned
                              ? styles.stepDotCompleted
                              : styles.stepDotUpcoming,
                          ]}
                        >
                          {selectedBadge.isEarned ? (
                            <Ionicons
                              name="checkmark"
                              size={12}
                              color="#FFFFFF"
                            />
                          ) : (
                            <Ionicons
                              name="lock-closed"
                              size={12}
                              color="#5A5F7A"
                            />
                          )}
                        </View>
                      </View>
                      <View style={styles.stepContentCol}>
                        <Text
                          style={[
                            styles.stepTitle,
                            selectedBadge.isEarned
                              ? styles.stepTitleCompleted
                              : styles.stepTitleUpcoming,
                          ]}
                        >
                          {t("profile.step3")}
                        </Text>
                        <Text style={styles.stepDesc}>
                          "{getLocalizedBadgeDesc(selectedBadge.description)}"
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {selectedBadge.isEarned ? (
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { backgroundColor: "#10B981", shadowColor: "#10B981" },
                    ]}
                    onPress={() => {
                      Share.share({
                        message:
                          i18n.language === "en"
                            ? `I just earned the "${getLocalizedBadgeName(selectedBadge.name)}" badge at BiblioTech! 🏆\n"${getLocalizedBadgeDesc(selectedBadge.description)}"`
                            : `Tôi vừa đạt được huy hiệu "${selectedBadge.name}" tại BiblioTech! 🏆\n"${selectedBadge.description}"`,
                        title:
                          i18n.language === "en"
                            ? "BiblioTech Badge"
                            : "Huy hiệu BiblioTech",
                      });
                    }}
                  >
                    <Ionicons
                      name="share-social"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveBtnText}>
                      {t("profile.share_achievement", "Chia sẻ thành tích")}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      setIsRoadmapVisible(false);
                      router.push("/(member)" as any);
                    }}
                  >
                    <Ionicons
                      name="book"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveBtnText}>
                      {t("profile.explore_books_now", "Khám phá kho sách ngay")}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Avatar Options Action Sheet Modal */}
      <Modal
        visible={isAvatarSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAvatarSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setIsAvatarSheetVisible(false)}
        >
          <View style={styles.actionSheetContent}>
            <View style={styles.actionSheetHeader}>
              <View style={styles.actionSheetHandle} />
              <Text style={styles.actionSheetTitle}>{t("profile.avatar")}</Text>
            </View>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setIsAvatarSheetVisible(false);
                setIsAvatarPreviewVisible(true);
              }}
            >
              <View
                style={[
                  styles.actionIconWrapper,
                  { backgroundColor: "rgba(58, 117, 242, 0.2)" },
                ]}
              >
                <Ionicons name="eye-outline" size={20} color="#3A75F2" />
              </View>
              <Text style={styles.actionSheetItemText}>
                {t("profile.view_avatar", "Xem ảnh đại diện")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setIsAvatarSheetVisible(false);
                pickImage();
              }}
            >
              <View
                style={[
                  styles.actionIconWrapper,
                  { backgroundColor: "rgba(16, 185, 129, 0.2)" },
                ]}
              >
                <Ionicons name="images-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.actionSheetItemText}>
                {t("profile.pick_from_library", "Chọn ảnh từ thư viện")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setIsAvatarSheetVisible(false);
                handleRemoveAvatar();
              }}
            >
              <View
                style={[
                  styles.actionIconWrapper,
                  { backgroundColor: "rgba(239, 68, 68, 0.2)" },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.actionSheetItemText, { color: "#EF4444" }]}>
                {t("profile.remove_avatar", "Gỡ ảnh đại diện")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionSheetItem,
                {
                  marginTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: "#1F263B",
                  justifyContent: "center",
                },
              ]}
              onPress={() => setIsAvatarSheetVisible(false)}
            >
              <Text
                style={[
                  styles.actionSheetItemText,
                  { color: "#8A8F9E", textAlign: "center" },
                ]}
              >
                {t("common.cancel", "Hủy")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Avatar Preview Modal */}
      <Modal
        visible={isAvatarPreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAvatarPreviewVisible(false)}
      >
        <View style={styles.previewModalOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setIsAvatarPreviewVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <Image
            source={{
              uri:
                profile?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${profile?.fullName || "User"}&background=3A75F2&color=fff`,
            }}
            style={styles.previewLargeImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F121D" },
  scrollContent: { paddingBottom: 40 },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: -10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  profileHeader: {
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#3A75F2",
    padding: 3,
    marginBottom: 16,
    position: "relative",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    backgroundColor: "#171B2B",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3A75F2",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0F121D",
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: "rgba(58, 117, 242, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  roleText: {
    color: "#3A75F2",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  userId: {
    color: "#5A5F7A",
    fontSize: 12,
  },
  userBio: {
    color: "#8A8F9E",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
    marginBottom: 12,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  editBtnText: {
    color: "#3A75F2",
    fontSize: 12,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 15,
    marginTop: 0,
    justifyContent: "space-between",
  },
  statItem: {
    width: (width - 45) / 2,
    borderRadius: 18,
    padding: 16,
    marginBottom: 15,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  statVal: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  statLab: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
  },
  chartContainer: {
    backgroundColor: "#171B2B",
    borderRadius: 20,
    padding: 15,
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  emptyChart: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#5A5F7A",
    fontSize: 14,
    marginTop: 10,
  },
  actionSection: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171B2B",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 0,
    borderColor: "transparent",
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badgeItem: {
    width: (width - 60) / 3,
    backgroundColor: "#171B2B",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 0,
    borderColor: "transparent",
  },
  activeBadge: {
    borderColor: "transparent",
    backgroundColor: "rgba(245, 158, 11, 0.05)",
  },
  inactiveBadge: {
    opacity: 0.6,
  },
  badgeLabel: {
    color: "#5A5F7A",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  activeBadgeLabel: {
    color: "#FFFFFF",
  },
  digitalCard: {
    padding: 24,
    borderRadius: 24,
    height: 200,
    justifyContent: "space-between",
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  cardBrand: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cardType: {
    color: "#3A75F2",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  levelContainer: {
    width: "100%",
    paddingHorizontal: 30,
    marginTop: 10,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  levelBadge: {
    backgroundColor: "#3A75F2",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  levelText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  xpBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  xpBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: "#3A75F2",
    borderRadius: 3,
  },
  xpText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "bold",
  },
  shareProfileBtn: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  badgeCountText: {
    color: "#3A75F2",
    fontSize: 12,
    fontWeight: "bold",
  },
  badgeList: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  badgeItemCard: {
    width: 140,
    backgroundColor: "#171B2B",
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  activeBadgeCard: {
    borderColor: "rgba(245, 158, 11, 0.3)",
    backgroundColor: "#1C2031",
  },
  inactiveBadgeCard: {
    opacity: 0.6,
  },
  badgeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  badgeName: {
    color: "#8A8F9E",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  activeBadgeName: {
    color: "#FFFFFF",
  },
  badgeDesc: {
    color: "#5A5F7A",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
    marginBottom: 10,
  },
  earnedCheck: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  earnedText: {
    color: "#10B981",
    fontSize: 9,
    fontWeight: "bold",
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardQrContainer: {
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 12,
    marginRight: 20,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardNumber: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "monospace",
    marginTop: 4,
  },
  cardExpiryRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  cardMiniLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 8,
    fontWeight: "700",
  },
  cardMiniVal: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#171B2B",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  genreChipText: {
    color: "#8A8F9E",
    fontSize: 13,
  },
  genreChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0F121D",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderColor: "#1F263B",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  modalBody: {
    marginBottom: 20,
  },
  inputLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputSubLabel: {
    color: "#5A5F7A",
    fontSize: 12,
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: "#171B2B",
    borderRadius: 16,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 14,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#1F263B",
    minHeight: 100,
  },
  genreSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  genreOption: {
    backgroundColor: "#171B2B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  genreOptionSelected: {
    backgroundColor: "rgba(58, 117, 242, 0.2)",
    borderColor: "#3A75F2",
  },
  genreOptionText: {
    color: "#8A8F9E",
    fontSize: 14,
    fontWeight: "500",
  },
  genreOptionTextSelected: {
    color: "#3A75F2",
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: "#3A75F2",
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  activeGenreChip: {
    backgroundColor: "rgba(58, 117, 242, 0.2)",
    borderColor: "#3A75F2",
  },
  activeGenreChipText: {
    color: "#3A75F2",
    fontWeight: "700",
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  shareCardBtn: {
    flex: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(58, 117, 242, 0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  shareCardBtnText: {
    color: "#3A75F2",
    fontSize: 13,
    fontWeight: "bold",
    marginLeft: 4,
    flexShrink: 1,
  },
  offlineAccessBtn: {
    flex: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3A75F2",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  offlineAccessText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    marginLeft: 4,
    flexShrink: 1,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cardAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  memberName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  memberId: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontFamily: "monospace",
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  statLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  qrPlaceholder: {
    width: 50,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  badgeIconContainer: {
    position: "relative",
    alignItems: "center",
    marginBottom: 12,
  },
  shareBadgeBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#3A75F2",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#171B2B",
  },
  analyticsCard: {
    marginHorizontal: 20,
    marginBottom: 25,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  analyticsGradient: {
    flexDirection: "row",
    padding: 20,
    alignItems: "center",
    justifyContent: "space-between",
  },
  analyticsInfo: {
    flex: 1,
    marginRight: 15,
  },
  analyticsTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  analyticsDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    lineHeight: 16,
  },
  chartTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  chartSubtitle: {
    color: "#5A5F7A",
    fontSize: 12,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  analyticsIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  walletActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
    marginBottom: 20,
    width: "100%",
  },
  walletBtn: {
    flex: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  walletBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
    flexShrink: 1,
  },
  roadmapBox: {
    backgroundColor: "#171B2B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F263B",
    padding: 18,
    marginBottom: 8,
  },
  roadmapStepRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  stepIndicatorCol: {
    alignItems: "center",
    marginRight: 16,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  stepDotActive: {
    backgroundColor: "#3A75F2",
    borderColor: "#3A75F2",
  },
  stepDotUpcoming: {
    backgroundColor: "#171B2B",
    borderColor: "#3D4260",
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#1F263B",
    marginTop: 4,
    marginBottom: 4,
  },
  stepLineCompleted: {
    backgroundColor: "#10B981",
  },
  stepContentCol: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 14,
    color: "#8A8F9E",
    fontWeight: "bold",
    marginBottom: 4,
  },
  stepTitleActive: {
    color: "#FFFFFF",
  },
  stepTitleCompleted: {
    color: "#10B981",
  },
  stepTitleUpcoming: {
    color: "#5A5F7A",
  },
  stepDesc: {
    fontSize: 12,
    color: "#5A5F7A",
    lineHeight: 16,
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 18, 29, 0.6)",
    justifyContent: "flex-end",
  },
  actionSheetContent: {
    backgroundColor: "#171B2B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  actionSheetHeader: {
    alignItems: "center",
    paddingVertical: 16,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3D4260",
    marginBottom: 12,
  },
  actionSheetTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  actionSheetItemText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 16,
  },
  actionIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  previewCloseBtn: {
    position: "absolute",
    top: 50,
    right: 24,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewLargeImage: {
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: 20,
  },
  shareCardModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  shareMenuModalContent: {
    backgroundColor: "#0F121D",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: "#1F263B",
  },
  shareIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  shareDesc: {
    color: "#8A8F9E",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
  },
  shareOptionList: {
    gap: 16,
    marginBottom: 10,
  },
  shareOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171B2B",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  shareOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  shareOptionTextCol: {
    flex: 1,
  },
  shareOptionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 2,
  },
  shareOptionSubtitle: {
    color: "#5A5F7A",
    fontSize: 12,
  },
});
