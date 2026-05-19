import { Ionicons } from "@expo/vector-icons";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";
import { Audio } from "expo-av";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { supabase } from "../../src/api/supabase";
import { AnimatedWrapper } from "../../src/components/AnimatedWrapper";
import { LanguageMenuToggle } from "../../src/components/LanguageSwitcher";
import { NotificationCenter } from "../../src/components/NotificationCenter";
import { ai } from "../../src/core/ai";
import { haptics } from "../../src/core/haptics";
import { sync, SyncAction } from "../../src/core/sync";
import { OfflineCard } from "../../src/features/members/components/OfflineCard";
import { membersService } from "../../src/features/members/member-service";
import { Book, BorrowRecord } from "../../src/hooks/library/types";
import { useBroadcast } from "../../src/hooks/useBroadcast";
import { useConnectivity } from "../../src/hooks/useConnectivity";
import { useGamification } from "../../src/hooks/useGamification";
import { useLibrary } from "../../src/hooks/useLibrary";
import { useAuthStore } from "../../src/store/useAuthStore";

const { width } = Dimensions.get("window");

const ChartPlaceholder = ({ title }: { title: string }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.placeholderContainer}>
      <Ionicons name="analytics-outline" size={42} color="#2D3142" />
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSub}>{t("messages.no_history")}</Text>
    </View>
  );
};

export default function MemberHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const profile = useAuthStore((state) => state.profile);
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const updateAvatar = useAuthStore((state) => state.updateAvatar);
  const {
    books,
    borrows,
    recommendations,
    feed,
    stats: kernelStats,
    getCollection,
  } = useLibrary();
  const { latestMessage, dismissLatest } = useBroadcast();
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

        const fileName = `${profile?.id || "user"}_${Date.now()}.jpg`;
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
          .eq("id", profile?.id);

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
  const [activeRecTab, setActiveRecTab] = useState<"interests" | "ai">("interests");
  const { points, level, currentLevelXP, nextLevelXP } = useGamification(
    profile?.id || "",
  );
  const [queueCount, setQueueCount] = useState(0);
  const { data: interestRecs, isLoading: isInterestLoading } = recommendations?.interests?.() || { data: [], isLoading: false };
  const { data: semanticRecs, isLoading: isSemanticLoading } = recommendations?.get?.(6) || { data: [], isLoading: false };

  const recBooks = activeRecTab === 'interests' ? interestRecs : semanticRecs;
  const isRecLoading = activeRecTab === 'interests' ? isInterestLoading : isSemanticLoading;
  const { data: feedData, isLoading: isFeedLoading } = feed.getCommunityFeed();

  const [showNotifications, setShowNotifications] = useState(false);

  const { data: bookList } = books.list();
  const { data: onlineBorrows, isLoading: loadingBorrows } = borrows.list();
  const [offlineBorrows, setOfflineBorrows] = useState<BorrowRecord[]>([]);
  const [offlineBooks, setOfflineBooks] = useState<Book[]>([]);

  // Derived state moved up to avoid "used before declaration"
  const myBorrows = onlineBorrows || offlineBorrows;
  const { isOnline, isSyncing, triggerSync } = useConnectivity();
  const [isOfflineCardVisible, setIsOfflineCardVisible] = useState(false);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [aiRecs, setAiRecs] = useState<Book[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);

  const mockPhrases = [
    t("common.voice_phrase_1"),
    t("common.voice_phrase_2"),
    t("common.voice_phrase_3"),
  ];

  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [syncQueue, setSyncQueue] = useState<SyncAction[]>([]);
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null);

  React.useEffect(() => {
    const performCheckin = async () => {
      if (profile?.id) {
        try {
          const { data, error } = await supabase.rpc("daily_checkin", {
            p_user_id: profile.id,
          });
          if (!error && data?.success) {
            console.log(
              "[Gamification] Daily Check-in Success:",
              data.xp_awarded,
              "XP awarded",
            );
            // Optionally: Show a toast or notification
          }
        } catch (e) {
          console.warn("Daily checkin failed:", e);
        }
      }
    };
    performCheckin();
  }, [profile?.id]);

  React.useEffect(() => {
    const checkOffline = async () => {
      const cachedBorrows = await membersService.getBorrows();
      const cachedBooks = await membersService.getBooks();
      const queue = await membersService.getActionQueue();
      setOfflineBorrows(cachedBorrows);
      setOfflineBooks(cachedBooks);
      setQueueCount(queue.length);
    };
    checkOffline();

    // Refresh queue count periodically or on focus
    const interval = setInterval(checkOffline, 5000);
    return () => clearInterval(interval);
  }, [onlineBorrows, loadingBorrows]);

  // Update cache when online data arrives
  React.useEffect(() => {
    if (onlineBorrows && onlineBorrows.length > 0) {
      membersService.saveBorrows(onlineBorrows);
    }
  }, [onlineBorrows]);

  React.useEffect(() => {
    if (bookList && bookList.length > 0) {
      membersService.saveBooks(bookList);
    }
  }, [bookList]);

  // Sync queue monitoring
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSyncQueue([...sync.getQueue()]);
    }, 5000);

    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState(state);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  // Audio cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [recording]);

  // Fetch AI Recommendations (Semantic Discovery)
  React.useEffect(() => {
    const fetchAiRecs = async () => {
      if (myBorrows && myBorrows.length > 0) {
        setIsAiLoading(true);
        try {
          const titles = myBorrows.map((b: any) => b.book?.title || "");
          const categories = Array.from(
            new Set(
              myBorrows.map((b: any) => b.book?.category || "").filter(Boolean),
            ),
          ) as string[];

          const results = await ai.getRecommendationsByProfile(
            titles,
            categories,
          );

          // Filter out books already borrowed
          const borrowedIsbns = new Set(
            myBorrows.map((b: any) => b.book?.isbn).filter(Boolean),
          );
          const filteredBooks = results.filter(
            (b: any) => !borrowedIsbns.has(b.isbn),
          );

          setAiRecs(filteredBooks.slice(0, 5));
        } catch (error) {
          console.error("AI Recommendation fetch failed:", error);
        } finally {
          setIsAiLoading(false);
        }
      }
    };
    if (myBorrows) fetchAiRecs();
  }, [myBorrows]);

  const startListening = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        setIsListening(true);
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setRecording(recording);

        // Simulate voice processing after 3 seconds
        setTimeout(async () => {
          await stopListening(true);
        }, 3000);
      } else {
        Alert.alert(
          t("messages.mic_permission"),
          t("messages.mic_permission_desc"),
        );
      }
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopListening = async (shouldProcess = false) => {
    setIsListening(false);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      if (shouldProcess) {
        haptics.success();
        // Mock transcription
        const transcript =
          mockPhrases[Math.floor(Math.random() * mockPhrases.length)];

        const result = await ai.processVoiceCommand(transcript);
        setAiResponse(result);
        setShowAiModal(true);

        if (result.intent === "search" && result.searchQuery) {
          // Optional: navigate to search with query
        }
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
    setRecording(null);
  };

  // State and Data derived from hooks
  const myBooks = bookList || offlineBooks;

  const timeAgo = (date: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / 1000,
    );
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("common.mins_ago", { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${t("common.hours_ago", { hours })}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t("common.days_ago", { days })}`;
  };

  const [activeCategory, setActiveCategory] = useState("all");
  const categories = [
    "all",
    "Fiction",
    "Business & Economics",
    "Science",
    "Computers",
    "Psychology",
    "History",
    "Technology",
    "Art",
    "Children's Books",
  ];

  const filteredBooks = React.useMemo(() => {
    if (!myBooks) return [];
    if (activeCategory === "all") return myBooks;
    
    return myBooks.filter((book: any) => {
      const cat = (book.category || "").toLowerCase();
      const googleCats = book.google_data?.categories?.map((c: string) => c.toLowerCase()) || [];
      const targetKey = activeCategory.toLowerCase();
      
      // Check direct category, google_data categories, and translated matches
      const isMatch = cat === targetKey || 
                    googleCats.includes(targetKey) ||
                    String(t(`categories.${book.category}`)).toLowerCase() === targetKey;
      
      return isMatch;
    });
  }, [myBooks, activeCategory, t]);
  const getCategoryLabel = (cat: string) => {
    if (cat === "all") return t("common.all");
    return t(`categories.${cat}`, cat);
  };

  // Real-time stats & Overdue logic from Kernel
  const {
    activeCount: activeBorrowedCount,
    totalFine,
    hasOverdue,
  } = kernelStats;

  const featuredBooks = getCollection("trending", 5);

  const stats = React.useMemo(
    () => [
      {
        label: t("member.my_borrows"),
        value: activeBorrowedCount,
        icon: "book",
        bgColor: "#3A75F2",
        flex: 1,
      },
      {
        label: t("librarian.total_books"),
        value: myBooks?.length || 0,
        icon: "library",
        bgColor: "#10B981",
        flex: 1,
      },
      {
        label: t("profile.total_fine"),
        value: totalFine > 0 ? totalFine / 1000 + "k" : t("member.limit_5"),
        icon: "card",
        bgColor: totalFine > 0 ? "#EF4444" : "#F59E0B",
        flex: 1,
      },
    ],
    [activeBorrowedCount, myBooks?.length, totalFine, t],
  );

  // Logic for charts
  const chartColors = [
    "#3A75F2",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
  ];
  const genreData = React.useMemo(
    () =>
      myBorrows?.reduce((acc: any[], curr: BorrowRecord) => {
        const genre = curr.book?.category || t("common.uncategorized");
        const existing = acc.find((g: any) => g.name === genre);
        if (existing) existing.population++;
        else
          acc.push({
            name: genre,
            population: 1,
            color: ["#10B981", "#34D399", "#059669", "#10B981", "#6EE7B7"][
              acc.length % 5
            ],
            legendFontColor: "#8A8F9E",
            legendFontSize: 11,
          });
        return acc;
      }, []) || [],
    [myBorrows],
  );

  const borrowStats = React.useMemo(() => {
    const statsArr = [0, 0, 0, 0, 0, 0];
    if (!myBorrows || myBorrows.length === 0) return statsArr;

    myBorrows.forEach((b: BorrowRecord) => {
      if (!b.borrowed_at) return;
      const date = new Date(b.borrowed_at);
      const diff = Math.floor(
        (new Date().getTime() - date.getTime()) / (1000 * 3600 * 24 * 30),
      );
      if (diff >= 0 && diff < 6) statsArr[5 - diff]++;
    });
    return statsArr;
  }, [myBorrows]);

  const chartConfig = {
    backgroundGradientFrom: "#0F172A",
    backgroundGradientTo: "#0F172A",
    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F121D" />

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="white" />
          <Text style={styles.offlineBannerText}>
            {t("common.offline_mode")}
          </Text>
        </View>
      )}

      {queueCount > 0 && isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: "#3A75F2" }]}>
          <ActivityIndicator
            size="small"
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.offlineBannerText}>
            {t("common.syncing_activities", { count: queueCount })}
          </Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Friendly Profile Header */}
        <Animated.View
          entering={FadeInDown.delay(200)}
          style={styles.friendlyHeader}
        >
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.friendlyGreeting}>
                {t("common.good_morning")}
              </Text>
              <Text style={styles.friendlyName}>
                {profile?.fullName || t("common.reader")}
              </Text>
            </View>
            <View style={styles.headerActions}>
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
                style={[styles.avatarWrapper, { marginLeft: 12 }]}
              >
                {profile?.avatarUrl ? (
                  <Image
                    source={{ uri: profile.avatarUrl }}
                    style={styles.largeAvatar}
                  />
                ) : (
                  <View style={[styles.largeAvatar, styles.avatarFallback]}>
                    <Text style={styles.avatarTextLarge}>
                      {profile?.fullName?.charAt(0) || "D"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

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
                  {profile?.fullName || t("roles.member")}
                </Text>
                <Text style={styles.menuUserSub}>
                  {profile?.email || "member@bibliotech.ai"}
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

        {/* Prominent Search Bar */}
        <Animated.View
          entering={FadeInDown.delay(300)}
          style={styles.searchContainer}
        >
          <View style={styles.searchBar}>
            <TouchableOpacity
              onPress={() => router.push("/(member)/search" as any)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
              activeOpacity={0.9}
            >
              <Ionicons name="search-outline" size={20} color="#8A8F9E" />
              <Text style={styles.searchPlaceholder}>
                {t("a11y.search_hint")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(member)/search",
                  params: { openFilter: "true" },
                } as any)
              }
              style={styles.filterBtn}
            >
              <Ionicons name="options-outline" size={18} color="#4F8EF7" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Intuitive Quick Actions Grid */}
        <View style={styles.friendlyActionsGrid}>
          <TouchableOpacity
            onPress={() => setIsOfflineCardVisible(true)}
            style={styles.friendlyActionItem}
          >
            <LinearGradient
              colors={["#3A75F2", "#2D5BD0"]}
              style={styles.friendlyActionIcon}
            >
              <Ionicons name="qr-code" size={24} color="white" />
            </LinearGradient>
            <Text style={styles.friendlyActionLabel}>
              {t("member.id_card")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(member)/search" as any)}
            style={styles.friendlyActionItem}
          >
            <LinearGradient
              colors={["#10B981", "#0D9488"]}
              style={styles.friendlyActionIcon}
            >
              <Ionicons name="book" size={24} color="white" />
            </LinearGradient>
            <Text style={styles.friendlyActionLabel}>
              {t("member.borrow_books")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(member)/history" as any)}
            style={styles.friendlyActionItem}
          >
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              style={styles.friendlyActionIcon}
            >
              <Ionicons name="time" size={24} color="white" />
            </LinearGradient>
            <Text style={styles.friendlyActionLabel}>
              {t("member.history")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(member)/community" as any)}
            style={styles.friendlyActionItem}
          >
            <LinearGradient
              colors={["#8B5CF6", "#7C3AED"]}
              style={styles.friendlyActionIcon}
            >
              <Ionicons name="people" size={24} color="white" />
            </LinearGradient>
            <Text style={styles.friendlyActionLabel}>
              {t("member.community")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* BROADCAST BANNER */}
        {latestMessage && (
          <Animated.View
            entering={FadeInDown.duration(600)}
            style={[
              styles.broadcastBanner,
              {
                borderLeftColor:
                  latestMessage.type === "warning"
                    ? "#F59E0B"
                    : latestMessage.type === "promotion"
                      ? "#10B981"
                      : "#3A75F2",
              },
            ]}
          >
            <View style={styles.broadcastIcon}>
              <Ionicons
                name={
                  latestMessage.type === "warning"
                    ? "warning"
                    : latestMessage.type === "promotion"
                      ? "gift"
                      : "megaphone"
                }
                size={20}
                color={
                  latestMessage.type === "warning"
                    ? "#F59E0B"
                    : latestMessage.type === "promotion"
                      ? "#10B981"
                      : "#3A75F2"
                }
              />
            </View>
            <View style={styles.broadcastInfo}>
              <Text style={styles.broadcastTitle}>{latestMessage.title}</Text>
              <Text style={styles.broadcastContent} numberOfLines={2}>
                {latestMessage.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={dismissLatest}
              style={styles.closeBroadcast}
            >
              <Ionicons name="close" size={18} color="#5A5F7A" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* OVERDUE ALERT BANNER */}
        {(hasOverdue || totalFine > 0) && (
          <TouchableOpacity
            style={styles.overdueBanner}
            onPress={() => router.push("/(member)/profile" as any)}
            activeOpacity={0.9}
            accessibilityRole="alert"
            accessibilityLabel={`${t("member.overdue_warning")}: ${t("member.overdue_fine_notice", { amount: totalFine.toLocaleString() })}`}
            accessibilityHint={t("member.overdue_hint")}
          >
            <LinearGradient
              colors={["#FF6B6B", "#EE5253"]}
              style={styles.bannerGradient}
            >
              <Ionicons
                name="warning"
                size={22}
                color="#FFFFFF"
                accessibilityElementsHidden={true}
              />
              <View style={styles.bannerInfo}>
                <Text style={styles.bannerTitle}>
                  {t("member.overdue_warning")}
                </Text>
                <Text style={styles.bannerSubtitle}>
                  {t("member.overdue_fine_notice", {
                    amount: totalFine.toLocaleString(),
                  })}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#FFFFFF"
                accessibilityElementsHidden={true}
              />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Sync Stats Cards - Matching Librarian Classic Layout */}
        <View style={styles.statsRow} accessibilityLabel={t("common.summary_stats")}>
          {stats.map((stat, index) => (
            <AnimatedWrapper
              key={index}
              index={index}
              delay={80}
              style={{
                flex: stat.flex,
                marginRight: index !== stats.length - 1 ? 10 : 0,
              }}
            >
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: stat.bgColor, flex: 1 },
                ]}
                accessible={true}
                accessibilityLabel={`${stat.label}: ${stat.value}`}
              >
                <View style={styles.statTop}>
                  <Ionicons
                    name={stat.icon as any}
                    size={18}
                    color="rgba(255,255,255,0.9)"
                    accessibilityElementsHidden={true}
                  />
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            </AnimatedWrapper>
          ))}
        </View>

        {/* Analytics Section */}
        <AnimatedWrapper index={3} type="fade">
          <View
            style={[
              styles.analyticsCard,
              { borderColor: "rgba(16, 185, 129, 0.2)", borderWidth: 1 },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name="analytics"
                  size={20}
                  color="#10B981"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.analyticsTitle, { color: "#10B981" }]}>
                  {t("common.ai_insights")}
                </Text>
              </View>
            </View>
            <View style={styles.chartRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chartLabel}>
                  {t("member.knowledge_growth")}
                </Text>
                {myBorrows?.length > 0 ? (
                  <LineChart
                    data={{
                      labels: ["M-5", "M-4", "M-3", "M-2", "M-1", "M0"],
                      datasets: [{ data: borrowStats }],
                    }}
                    width={width - 80}
                    height={160}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    withDots={false}
                    withInnerLines={false}
                    withOuterLines={false}
                    withVerticalLines={false}
                    withHorizontalLines={false}
                    withScrollableDot={false}
                  />
                ) : (
                  <ChartPlaceholder title={t("member.borrowing_trend")} />
                )}
              </View>
            </View>

            <View style={{ marginTop: 24 }}>
              <Text style={styles.chartLabel}>
                {t("member.fav_genre_distribution")}
              </Text>
              {genreData?.length > 0 ? (
                <PieChart
                  data={genreData}
                  width={width - 60}
                  height={140}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              ) : (
                <ChartPlaceholder title={t("member.genre_distribution")} />
              )}
            </View>
          </View>
        </AnimatedWrapper>

        {/* Community Feed Preview */}
        <View style={styles.feedContainer}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{t("community.title")}</Text>
              <Text style={styles.sectionSubtitle}>
                {t("community.subtitle")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(member)/community" as any)}
            >
              <Text style={styles.viewAll}>{t("common.view_all")}</Text>
            </TouchableOpacity>
          </View>

          {isFeedLoading ? (
            <ActivityIndicator color="#4F8EF7" style={{ marginVertical: 20 }} />
          ) : feedData && feedData.length > 0 ? (
            <View style={styles.feedList}>
              {feedData.slice(0, 3).map((activity: any, index: number) => (
                <AnimatedWrapper
                  key={activity.id}
                  index={index}
                  delay={100}
                  onPress={() =>
                    router.push(`/(member)/book/${activity.bookIsbn}` as any)
                  }
                >
                  <View
                    style={[
                      styles.feedItem,
                      index === 2 && { borderBottomWidth: 0 },
                    ]}
                    accessibilityRole="link"
                    accessibilityLabel={`${activity.userName} ${activity.type === "BORROW" ? t("community.just_borrowed") : t("community.just_reviewed")} ${activity.bookTitle}`}
                    accessibilityHint={t("a11y.view_book_hint")}
                  >
                    <View style={styles.feedAvatar}>
                      {activity.avatarUrl ? (
                        <Image
                          source={{ uri: activity.avatarUrl }}
                          style={styles.avatarImg}
                        />
                      ) : (
                        <View
                          style={[
                            styles.avatarPlaceholder,
                            {
                              opacity: activity.isActive ? 1 : 0.4,
                              backgroundColor:
                                activity.type === "BORROW"
                                  ? "#3A75F2"
                                  : "#F59E0B",
                            },
                          ]}
                        >
                          <Text style={styles.avatarText}>
                            {activity.userName.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.feedContent}>
                      <Text style={styles.feedText} numberOfLines={2}>
                        <Text style={styles.userName}>{activity.userName}</Text>
                        <Text style={styles.actionText}>
                          {activity.type === "BORROW"
                            ? t("community.just_borrowed")
                            : t("community.just_reviewed")}
                        </Text>
                        <Text style={styles.bookName}>
                          {activity.bookTitle}
                        </Text>
                      </Text>
                      <Text style={styles.feedTime}>
                        {timeAgo(activity.timestamp)}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#3D4260"
                    />
                  </View>
                </AnimatedWrapper>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyFeed}>{t("community.empty_feed")}</Text>
          )}
        </View>

        {/* Unified Personalized Recommendations Section */}
        <View style={styles.recommendationContainer}>
          <View style={styles.recommendationHeader}>
            <View style={styles.recTabGroup}>
              <TouchableOpacity 
                onPress={() => setActiveRecTab('interests')}
                style={[styles.recTab, activeRecTab === 'interests' && styles.activeRecTab]}
              >
                <Text style={[styles.recTabText, activeRecTab === 'interests' && styles.activeRecTabText]}>
                  {t("member.tab_interests")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setActiveRecTab('ai')}
                style={[styles.recTab, activeRecTab === 'ai' && styles.activeRecTab]}
              >
                <Text style={[styles.recTabText, activeRecTab === 'ai' && styles.activeRecTabText]}>
                  {t("member.tab_biblio_ai")}
                </Text>
              </TouchableOpacity>
            </View>
            
            {activeRecTab === 'interests' && (!profile?.favoriteGenres || profile.favoriteGenres.length === 0) && (
              <TouchableOpacity 
                style={styles.updateInterestsBtn}
                onPress={() => router.push('/(member)/profile')}
              >
                <Text style={styles.updateInterestsText}>{t("member.update_interests_cta")}</Text>
              </TouchableOpacity>
            )}

            {activeRecTab === 'ai' && (
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={10} color="#FFFFFF" />
                <Text style={styles.aiBadgeText}>BiblioAI</Text>
              </View>
            )}
          </View>

          {activeRecTab === 'interests' ? (
            (!profile?.favoriteGenres || profile.favoriteGenres.length === 0) ? (
              <View style={styles.emptyRecsContainer}>
                <View style={styles.emptyRecsIconBg}>
                  <Ionicons name="heart-outline" size={32} color="#3A75F2" />
                </View>
                <Text style={styles.emptyRecsText}>{t("member.no_interests_msg")}</Text>
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollPadding}
                style={styles.carousel}
              >
                {recommendations.interests().data?.map((book: any, idx: number) => (
                  <AnimatedWrapper
                    key={book.isbn}
                    index={idx}
                    type="slide-right"
                    style={styles.recCard}
                    onPress={() => router.push(`/(member)/book/${book.isbn}` as any)}
                  >
                    <Image source={{ uri: book.cover_url }} style={styles.recImage} />
                    <View style={styles.recInfo}>
                      <Text style={styles.recTitle} numberOfLines={1}>{book.title}</Text>
                      <View style={styles.recRating}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={styles.recRatingText}>{book.average_rating || "4.5"}</Text>
                      </View>
                    </View>
                  </AnimatedWrapper>
                ))}
              </ScrollView>
            )
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollPadding}
              style={styles.carousel}
            >
              {recommendations.get().data?.map((book: any, idx: number) => (
                <AnimatedWrapper
                  key={book.isbn}
                  index={idx}
                  type="slide-right"
                  style={styles.recCard}
                  onPress={() => router.push(`/(member)/book/${book.isbn}` as any)}
                >
                  <Image source={{ uri: book.cover_url }} style={styles.recImage} />
                  <View style={styles.recInfo}>
                    <Text style={styles.recTitle} numberOfLines={1}>{book.title}</Text>
                    <View style={styles.recRating}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={styles.recRatingText}>{book.average_rating || "4.5"}</Text>
                    </View>
                  </View>
                </AnimatedWrapper>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Featured Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("member.featured_books")}</Text>
          <TouchableOpacity onPress={() => router.push("/(member)/search")}>
            <Text style={styles.viewAll}>{t("common.view_all")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
        >
          {featuredBooks.map((book: any, index: number) => (
            <AnimatedWrapper
              key={book.isbn}
              index={index}
              type="slide-right"
              onPress={() => router.push(`/(member)/book/${book.isbn}` as any)}
              style={styles.featuredCard}
            >
              <Image
                source={{
                  uri:
                    book.cover_url ||
                    "https://images.unsplash.com/photo-1543005120-019f2ef5ef73",
                }}
                style={styles.featuredImage}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)"]}
                style={styles.featuredOverlay}
              >
                <Text style={styles.featuredTitle} numberOfLines={1}>
                  {book.title}
                </Text>
                <Text style={styles.featuredAuthor}>{book.author}</Text>
              </LinearGradient>
            </AnimatedWrapper>
          ))}
        </ScrollView>



        {/* Genre Chips */}
        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>{t("common.subjects")}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[
                styles.categoryChip,
                activeCategory === cat && styles.activeChip,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeCategory === cat }}
              accessibilityLabel={`${t("common.subject")} ${getCategoryLabel(cat)}`}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === cat && styles.activeCategoryText,
                ]}
              >
                {getCategoryLabel(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.booksGrid}>
          {filteredBooks.slice(0, 12).map((book: any, index: number) => (
            <AnimatedWrapper
              key={book.isbn}
              index={index % 2}
              delay={150}
              style={styles.bookGridItem}
              onPress={() => router.push(`/(member)/book/${book.isbn}` as any)}
            >
              <Image
                source={{
                  uri:
                    book.cover_url ||
                    "https://images.unsplash.com/photo-1543005120-019f2ef5ef73?q=80&w=200",
                }}
                style={styles.gridImage}
              />
              <Text style={styles.gridTitle} numberOfLines={1}>
                {book.title}
              </Text>
              <Text style={styles.gridAuthor}>{book.author}</Text>
            </AnimatedWrapper>
          ))}
        </View>

        <Modal visible={showAiModal} transparent animationType="slide">
          <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
            <View style={styles.aiModalContent}>
              <LinearGradient
                colors={["#1E2540", "#0B0F1A"]}
                style={styles.aiModalGradient}
              >
                <View style={styles.aiModalHeader}>
                  <Ionicons name="sparkles" size={24} color="#FFD700" />
                  <Text style={styles.aiModalTitle}>
                    {t("common.ai_librarian")}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAiModal(false)}>
                    <Ionicons name="close" size={24} color="#8B8FA3" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.aiModalBody}>
                  <Text style={styles.aiResponseText}>{aiResponse?.text}</Text>
                  {(aiResponse?.books?.length ?? 0) > 0 && (
                    <View style={styles.aiBooksSection}>
                      <Text style={styles.aiSubTitle}>
                        {t("common.books_suggested")}
                      </Text>
                      {aiResponse?.books?.map((book: any) => (
                        <TouchableOpacity
                          key={book.isbn || book.id}
                          style={styles.aiBookItem}
                          onPress={() => {
                            setShowAiModal(false);
                            router.push(`/(member)/book/${book.isbn}` as any);
                          }}
                        >
                          <Image
                            source={{ uri: book.cover_url }}
                            style={styles.aiBookCover}
                          />
                          <View style={styles.aiBookInfo}>
                            <Text style={styles.aiBookTitle} numberOfLines={1}>
                              {book.title}
                            </Text>
                            <Text style={styles.aiBookAuthor}>
                              {book.author}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#3A75F2"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </LinearGradient>
            </View>
          </BlurView>
        </Modal>

        <NotificationCenter
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
        />

        <OfflineCard
          visible={isOfflineCardVisible}
          onClose={() => setIsOfflineCardVisible(false)}
          profile={profile}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  friendlyHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
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
  friendlyGreeting: {
    color: "#8A8F9E",
    fontSize: 14,
    fontWeight: "500",
  },
  friendlyName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 4,
  },
  avatarWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#3A75F2",
    overflow: "hidden",
    backgroundColor: "#1E2540",
  },
  cameraOverlayBtn: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#3A75F2",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0F121D",
  },

  largeAvatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextLarge: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  recTabGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(23, 27, 43, 0.8)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1F263B',
  },
  recTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeRecTab: {
    backgroundColor: '#3A75F2',
  },
  recTabText: {
    color: '#8B8FA3',
    fontSize: 13,
    fontWeight: '600',
  },
  activeRecTabText: {
    color: '#FFFFFF',
  },
  updateInterestsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(58, 117, 242, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(58, 117, 242, 0.3)',
  },
  updateInterestsText: {
    color: '#3A75F2',
    fontSize: 12,
    fontWeight: '600',
  },
  horizontalScrollPadding: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  recCard: {
    width: 140,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#171B2B',
    borderWidth: 1,
    borderColor: '#1F263B',
  },
  recImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
  },
  recInfo: {
    padding: 10,
  },
  recTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  recAuthor: {
    color: '#8A8F9E',
    fontSize: 11,
  },
  emptyRecsContainer: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(58, 117, 242, 0.05)',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(58, 117, 242, 0.3)',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyRecsIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(58, 117, 242, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyRecsText: {
    color: '#8A8F9E',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 15,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171B2B",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  offlineBanner: {
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    zIndex: 1000,
  },
  searchPlaceholder: {
    color: "#5A5F7A",
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(79, 142, 247, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  friendlyActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 10,
  },
  friendlyActionItem: {
    alignItems: "center",
    width: (width - 60) / 4,
  },
  friendlyActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  friendlyActionLabel: {
    color: "#8A8F9E",
    fontSize: 11,
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  offlineBannerText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
  },
  welcomeText: { color: "#8A8F9E", fontSize: 13, marginBottom: 2 },
  nameText: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#171B2B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  levelBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#3A75F2",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0F121D",
  },
  levelText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold",
  },
  aiFab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 100,
  },
  aiFabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  offlineIndicatorText: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "800",
  },
  overdueBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    overflow: "hidden",
  },
  bannerGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  bannerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  bannerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  broadcastBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#171B2B",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1F263B",
    borderLeftWidth: 4,
  },
  broadcastIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(58, 117, 242, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  broadcastInfo: {
    flex: 1,
  },
  broadcastTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
  },
  broadcastContent: {
    color: "#8A8F9E",
    fontSize: 12,
    lineHeight: 16,
  },
  closeBroadcast: {
    padding: 4,
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 24,
    height: 80,
  },
  statCard: {
    borderRadius: 14,
    padding: 12,
    justifyContent: "space-between",
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  voiceOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceCard: {
    backgroundColor: "#171B2B",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "80%",
  },
  voiceWaveContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 80,
    gap: 8,
    marginBottom: 20,
  },
  voiceWave: { width: 4, borderRadius: 2, backgroundColor: "#3A75F2" },
  voiceStatus: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  cancelVoiceBtn: { padding: 12 },
  cancelVoiceText: { color: "#8A8F9E", fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  aiModalContent: {
    height: "70%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },
  aiModalGradient: { flex: 1, padding: 24 },
  aiModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    justifyContent: "space-between",
  },
  aiModalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 12,
  },
  aiModalBody: { flex: 1, marginTop: 8 },
  aiResponseText: { color: "#E1E4ED", fontSize: 15, lineHeight: 24 },
  aiBooksSection: { marginTop: 24 },
  aiSubTitle: {
    color: "#8A8F9E",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  aiBookItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C2237",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  aiBookCover: { width: 40, height: 56, borderRadius: 6 },
  aiBookInfo: { flex: 1, marginLeft: 12 },
  aiBookTitle: { color: "white", fontSize: 14, fontWeight: "bold" },
  aiBookAuthor: { color: "#8A8F9E", fontSize: 12, marginTop: 2 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  sectionSubtitle: { color: "#8A8F9E", fontSize: 11, marginTop: 2 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A75F2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  aiBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  recommendationContainer: { marginBottom: 10 },
  recCard: {
    width: 140,
    marginRight: 15,
    backgroundColor: "#171B2B",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  recImage: { width: "100%", height: 190 },
  recInfo: { padding: 10 },
  recTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  recRating: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  recRatingText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "bold",
    marginLeft: 4,
  },
  viewAll: { color: "#3A75F2", fontSize: 13, fontWeight: "600" },
  carousel: { paddingLeft: 20, marginBottom: 30 },
  featuredCard: {
    width: width * 0.7,
    height: 180,
    marginRight: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  featuredImage: { width: "100%", height: "100%" },
  featuredOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    height: "60%",
    justifyContent: "flex-end",
  },
  featuredTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  featuredAuthor: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  categoryScroll: { paddingLeft: 20, marginBottom: 30 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#171B2B",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  activeChip: { backgroundColor: "#3A75F2", borderColor: "#3A75F2" },
  categoryText: { color: "#6E768F", fontSize: 13, fontWeight: "700" },
  activeCategoryText: { color: "#FFFFFF" },
  booksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  bookGridItem: { width: "47%", marginBottom: 20 },
  gridImage: { width: "100%", height: 210, borderRadius: 16, marginBottom: 10 },
  gridTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  gridAuthor: { color: "#6E768F", fontSize: 11, marginTop: 2 },
  analyticsCard: {
    backgroundColor: "#171B2B",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  analyticsTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 20,
  },
  chartRow: { flexDirection: "row" },
  chartLabel: {
    color: "#8A8F9E",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    paddingRight: 40,
  },
  feedContainer: { marginBottom: 30 },
  feedList: {
    marginHorizontal: 20,
    backgroundColor: "#171B2B",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  feedItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  feedAvatar: { marginRight: 12 },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: "bold", fontSize: 16 },
  feedContent: { flex: 1, marginRight: 8 },
  feedText: { fontSize: 13, color: "#8A8F9E", lineHeight: 18 },
  userName: { color: "#FFFFFF", fontWeight: "bold" },
  actionText: { color: "#8A8F9E" },
  bookName: { color: "#4F8EF7", fontWeight: "600" },
  ratingText: { color: "#F59E0B", fontWeight: "bold" },
  feedTime: { fontSize: 11, color: "#5A5F7A", marginTop: 4 },
  emptyFeed: { color: "#5A5F7A", textAlign: "center", marginVertical: 20 },
  placeholderContainer: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(45, 49, 66, 0.3)",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#2D3142",
    marginVertical: 10,
  },
  placeholderTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  placeholderSub: {
    color: "#8A8F9E",
    fontSize: 11,
    marginTop: 4,
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
});
