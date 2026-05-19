import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Share,
  Modal,
  FlatList,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useLibrary,
  useSocial,
  useAudiobook,
} from "../../../src/hooks/useLibrary";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import Slider from "@react-native-community/slider";
import { useTranslation } from "react-i18next";

import { Audio } from "expo-av";
import { booksService } from "../../../src/features/books/books.service";

const { width: windowWidth } = Dimensions.get("window");
const width = Platform.OS === "web" ? Math.min(windowWidth, 400) : windowWidth;

export default function AudioPlayerScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data: book, isLoading, isError, error, refetch } = useAudiobook(id as string);

  useEffect(() => {
    console.log(`[AudioPlayer] State: isLoading=${isLoading}, isError=${isError}, hasBook=${!!book}`);
    if (isError) console.error("[AudioPlayer] Query Error:", error);
  }, [isLoading, isError, !!book]);

  const getLocalizedTitle = (b: any) => {
    let title =
      i18n.language === "en" ? b.title_en || b.title : b.title_vi || b.title;
    if (i18n.language === "en" && b.language === "vi") {
      title += ` (${t("audiobook.audio_vietnamese", "Audio Vietnamese")})`;
    }
    return title;
  };

  const getLocalizedAuthor = (b: any) => {
    if (i18n.language === "en") {
      return (
        b.author_en ||
        b.canonical_author ||
        b.author ||
        t("common.updating", "Đang cập nhật")
      );
    }
    return (
      b.author_vi ||
      b.canonical_author ||
      b.author ||
      t("common.updating", "Đang cập nhật")
    );
  };

  const getLocalizedNarrator = (b: any) => {
    if (i18n.language === "en") {
      return b.narrator_en || b.narrator;
    }
    return b.narrator_vi || b.narrator;
  };

  const { useAudiobookKernel } = useLibrary();
  const { status, load, toggle, seek, setRate, setSleepTimer } =
    useAudiobookKernel(id as string);
  const {
    isPlaying,
    position,
    duration,
    rate: playbackSpeed,
    sleepRemaining: sleepTimer,
    currentChapter: currentChapterIdx,
    isLoaded,
    isLoading: isAudioLoading,
    error: audioError,
  } = status;

  const getLocalizedDuration = (dur?: string) => {
    if (!dur || dur === "0 phút") return t("audiobook.updating", "Updating...");
    return dur
      .replace(/giờ/g, t("audiobook.hours", "hours"))
      .replace(/phút/g, t("audiobook.minutes", "minutes"))
      .replace(/giây/g, t("audiobook.seconds", "seconds"));
  };

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showChaptersModal, setShowChaptersModal] = useState(false);

  const isMounted = useRef(true);
  const statusCallbackRef = useRef<any>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (book) {
      setCoverUrl(
        book.canonical_cover_url ||
          book.cover_url ||
          "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800&auto=format&fit=crop",
      );
    }
  }, [book?.id]);

  const { isLiked, isBookmarked, toggleLike, toggleBookmark } = useSocial(
    id as string,
    "AUDIOBOOK",
  );
  const rotation = useSharedValue(0);

  useEffect(() => {
    async function initAudio() {
      if (!book?.id) return;

      let targetChapter = currentChapterIdx;
      if (targetChapter === null) {
        const savedChapter = await AsyncStorage.getItem(`audio_chapter_${id}`);
        targetChapter = savedChapter
          ? parseInt(savedChapter)
          : (book.chapters?.[0]?.index ?? 1);
      }

      console.log(`[AudioPlayer] Initializing with chapter ${targetChapter}`);
      if (targetChapter !== null) {
        load(book, targetChapter);
      } else {
        load(book, book.chapters?.[0]?.index ?? 1);
      }
    }

    if (book) {
      initAudio();
    }
  }, [book?.id, id, load]);

  const changeSpeed = async () => {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setRate(nextSpeed);
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    }
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  useEffect(() => {
    if (isPlaying) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 10000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      // Correctly cancel the animation when paused to prevent potential loops
      cancelAnimation(rotation);
    }
  }, [isPlaying]);

  const animatedDiskStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleShare = async () => {
    try {
      await Share.share({
        message: t(
          "audiobook.sharing_message",
          `Đang nghe "${book?.title}" trên BiblioTech! 🎧`,
        ),
        url: book?.source_url,
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Move the conditional rendering to the actual return section below hooks
  const renderLoading = (errorType?: string) => (
    <SafeAreaView style={[styles.container, { justifyContent: "center" }]}>
      <LinearGradient
        colors={["#1E2540", "#0B0F1A"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { position: "absolute", top: 0, left: 0, right: 0 }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(member)/audiobooks/index")}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
        {errorType === "PERMISSION_DENIED" ? (
          <>
            <Ionicons name="lock-closed" size={64} color="#F59E0B" style={{ marginBottom: 16 }} />
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
              {t("audiobook.premium_required", "Yêu cầu quyền truy cập")}
            </Text>
            <Text style={{ color: "#8A8F9E", fontSize: 14, textAlign: "center", marginBottom: 24 }}>
              {t("audiobook.premium_msg", "Nội dung này yêu cầu tài khoản Platinum hoặc quyền truy cập đặc biệt.")}
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: "#F59E0B", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }} 
              onPress={() => router.replace("/(member)/profile")}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{t("profile.upgrade_now", "Nâng cấp ngay")}</Text>
            </TouchableOpacity>
          </>
        ) : isError ? (
          <>
            <Ionicons name="cloud-offline-outline" size={64} color="#EF4444" style={{ marginBottom: 16 }} />
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
              {t("common.error_occurred", "Có lỗi xảy ra")}
            </Text>
            <Text style={{ color: "#8A8F9E", fontSize: 14, textAlign: "center", marginBottom: 24 }}>
              {errorType === "QUERY_TIMEOUT" 
                ? t("audiobook.timeout_msg", "Máy chủ phản hồi quá chậm. Vui lòng thử lại sau.")
                : t("audiobook.error_loading", "Không thể tải thông tin sách nói. Vui lòng kiểm tra kết nối mạng.")}
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: "#3A75F2", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }} 
              onPress={() => refetch()}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{t("common.retry", "Thử lại")}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#3A75F2" />
            <Text style={{ color: "#8A8F9E", marginTop: 24, fontSize: 14, textAlign: "center" }}>
              {t("common.loading", "Đang tải dữ liệu...")}
            </Text>
            {isLoading && (
              <Text style={{ color: "#4B5563", marginTop: 12, fontSize: 12, fontStyle: "italic" }}>
                {t("common.connecting_supabase", "Đang kết nối với máy chủ...")}
              </Text>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );

  const errorMsg = (isError && (error as any)?.message) || "";

  if (isLoading) return renderLoading();
  
  if (isError) {
    return renderLoading(errorMsg);
  }
  
  const hasChapters = book?.chapters && book.chapters.length > 0;
  const hasSource = !!book?.source_url;

  // Final check for missing data
  if (isError || !book || (!hasChapters && !hasSource)) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#1E2540", "#0B0F1A"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(member)/audiobooks/index")}
            style={styles.headerBtn}
          >
            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" style={{ marginBottom: 16 }} />
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
            {t("audiobook.unavailable", "Sách nói chưa sẵn sàng")}
          </Text>
          <Text style={{ color: "#8A8F9E", fontSize: 14, textAlign: "center", marginBottom: 24 }}>
            {t("audiobook.missing_data", "Xin lỗi, hiện tại không tìm thấy dữ liệu âm thanh cho cuốn sách này.")}
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: "#3A75F2", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }} 
            onPress={() => router.back()}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{t("common.back", "Quay lại")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#1E2540", "#0B0F1A"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(member)/audiobooks/index")}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("audiobook.now_playing", "Đang phát")}
        </Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
          <Ionicons name="share-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.diskSection}>
          <Animated.View style={[styles.diskWrapper, animatedDiskStyle]}>
            <Image
              source={{
                uri:
                  coverUrl ||
                  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800&auto=format&fit=crop",
              }}
              style={styles.diskImage}
              contentFit="cover"
              transition={200}
              onError={() => {
                setCoverUrl(
                  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800&auto=format&fit=crop",
                );
              }}
            />
          </Animated.View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title} numberOfLines={2}>
            {getLocalizedTitle(book)}
          </Text>
          <Text style={styles.author}>{getLocalizedAuthor(book)}</Text>
          {getLocalizedNarrator(book) && (
            <Text style={styles.narrator}>
              {t("audiobook.narrator_label", "Giọng đọc")}:{" "}
              {getLocalizedNarrator(book)}
            </Text>
          )}

          {audioError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{audioError}</Text>
              <TouchableOpacity onPress={() => load(book, currentChapterIdx || 1)}>
                <Text style={styles.retryText}>{t("common.retry", "Thử lại")}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.interactionRow}>
            <TouchableOpacity
              onPress={toggleLike}
              style={styles.interactionBtn}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={26}
                color={isLiked ? "#EF4444" : "#FFFFFF"}
              />
              <Text style={styles.interactionText}>
                {isLiked
                  ? t("audiobook.liked", "Đã thích")
                  : t("audiobook.like", "Thích")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleBookmark}
              style={styles.interactionBtn}
            >
              <Ionicons
                name={isBookmarked ? "bookmark" : "bookmark-outline"}
                size={24}
                color={isBookmarked ? "#3A75F2" : "#FFFFFF"}
              />
              <Text style={styles.interactionText}>
                {isBookmarked
                  ? t("audiobook.saved", "Đã lưu")
                  : t("audiobook.save", "Lưu lại")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlsSection}>
          <View style={styles.sliderRow}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={duration > 0 ? position / duration : 0}
              onSlidingComplete={(val) => seek(val * duration)}
              minimumTrackTintColor="#3A75F2"
              maximumTrackTintColor="#1E2540"
              thumbTintColor="#FFFFFF"
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          <View style={styles.mainControls}>
            <TouchableOpacity
              style={styles.subControl}
              onPress={() => seek(Math.max(0, position - 15000))}
            >
              <Ionicons name="play-back" size={28} color="#8A8F9E" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.playBtn} 
              onPress={toggle}
              disabled={isAudioLoading}
            >
              {isAudioLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={36}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.subControl}
              onPress={() => seek(Math.min(duration, position + 15000))}
            >
              <Ionicons name="play-forward" size={28} color="#8A8F9E" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerControls}>
        <TouchableOpacity
          style={
            Platform.OS === "web"
              ? [styles.footerBtn, { cursor: "pointer" as any }]
              : styles.footerBtn
          }
          onPress={changeSpeed}
        >
          <Text style={styles.speedText}>{playbackSpeed}x</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            Platform.OS === "web"
              ? [styles.footerBtn, { cursor: "pointer" as any }]
              : styles.footerBtn
          }
          onPress={() => setShowChaptersModal(true)}
        >
          <Ionicons name="list-outline" size={22} color="#8A8F9E" />
        </TouchableOpacity>

        <TouchableOpacity
          style={
            Platform.OS === "web"
              ? [
                  styles.footerBtn,
                  sleepTimer !== null && styles.activeFooterBtn,
                  { cursor: "pointer" as any },
                ]
              : [
                  styles.footerBtn,
                  sleepTimer !== null && styles.activeFooterBtn,
                ]
          }
          onPress={() => setShowSleepModal(true)}
        >
          <Ionicons
            name="moon-outline"
            size={20}
            color={sleepTimer !== null ? "#F59E0B" : "#8A8F9E"}
          />
          {sleepTimer !== null && (
            <Text style={styles.timerText}>{Math.floor(sleepTimer / 60)}m</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Sleep Timer Modal */}
      <Modal visible={showSleepModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.modalTitle}>
              {t("audiobook.sleep_timer", "Hẹn giờ tắt")}
            </Text>
            {[15, 30, 45, 60].map((mins) => (
              <TouchableOpacity
                key={mins}
                style={styles.modalOption}
                onPress={() => {
                  setSleepTimer(mins);
                  setShowSleepModal(false);
                }}
              >
                <Text style={styles.optionText}>
                  {mins} {t("audiobook.minutes_short", "phút")}
                </Text>
                {sleepTimer === mins * 60 && (
                  <Ionicons name="checkmark" size={20} color="#3A75F2" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalOption, { borderBottomWidth: 0 }]}
              onPress={() => {
                setSleepTimer(null);
                setShowSleepModal(false);
              }}
            >
              <Text style={[styles.optionText, { color: "#EF4444" }]}>
                {t("audiobook.turn_off_timer", "Tắt hẹn giờ")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowSleepModal(false)}
            >
              <Text style={styles.closeModalText}>
                {t("audiobooks.close", "Đóng")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Chapters Modal */}
      <Modal visible={showChaptersModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.modalTitle}>
              {t("audiobook.chapters", "Danh sách chương")}
            </Text>
            <FlatList
              data={
                book?.chapters?.length
                  ? [...book.chapters].sort((a, b) => a.index - b.index)
                  : [
                      {
                        index: 1,
                        title: t("audiobook.full_book", "Toàn bộ sách"),
                        duration_seconds: null,
                      },
                    ]
              }
              keyExtractor={(item) => item.index.toString()}
              renderItem={({ item }) => {
                const isActive =
                  (currentChapterIdx !== null
                    ? currentChapterIdx
                    : book?.chapters?.[0]?.index || 1) === item.index;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalOption,
                      isActive && {
                        backgroundColor: "rgba(58, 117, 242, 0.1)",
                      },
                    ]}
                    onPress={() => {
                      if (!isActive) {
                        load(book, item.index);
                      }
                      setShowChaptersModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isActive && { color: "#3A75F2", fontWeight: "bold" },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {!!item.duration_seconds && (
                      <Text style={styles.chapterTime}>
                        {getLocalizedDuration(
                          booksService.formatDuration(item.duration_seconds),
                        )}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowChaptersModal(false)}
            >
              <Text style={styles.closeModalText}>
                {t("audiobook.close", "Đóng")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    zIndex: 10,
  },
  scrollContent: { paddingBottom: 40, flexGrow: 1, justifyContent: "center" },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#8A8F9E",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  diskSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    height: width * 0.8,
  },
  diskWrapper: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: (width * 0.75) / 2,
    borderWidth: 10,
    borderColor: "#151929",
    overflow: "hidden",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  diskImage: { width: "100%", height: "100%" },
  diskCenter: {
    position: "absolute",
    top: "40%",
    left: "40%",
    width: "20%",
    height: "20%",
    borderRadius: 100,
    backgroundColor: "#0B0F1A",
    borderWidth: 2,
    borderColor: "#1E2540",
  },
  infoSection: { alignItems: "center", marginTop: 40, paddingHorizontal: 40 },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  author: { color: "#8A8F9E", fontSize: 16, marginTop: 8, fontWeight: "500" },
  narrator: { color: "#5A5F7A", fontSize: 13, marginTop: 4, fontWeight: "500" },
  interactionRow: { flexDirection: "row", gap: 24, marginTop: 24 },
  interactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  interactionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  controlsSection: { marginTop: 40, paddingHorizontal: 30 },
  sliderRow: { marginBottom: 30 },
  slider: { width: "100%", height: 40 },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -8,
  },
  timeText: { color: "#5A5F7A", fontSize: 12, fontWeight: "600" },
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    marginBottom: 16,
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  subControl: { padding: 10 },
  footerControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1E2540",
    paddingTop: 16,
    paddingBottom: Platform.OS === "web" ? 140 : 40,
    paddingHorizontal: 60,
    backgroundColor: "#0B0F1A",
    zIndex: 100,
  },
  footerBtn: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#151929",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  activeFooterBtn: {
    backgroundColor: "rgba(58, 117, 242, 0.1)",
  },
  speedText: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  timerText: { color: "#F59E0B", fontSize: 10, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#151929",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  optionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "500" },
  chapterTime: { color: "#8A8F9E", fontSize: 14 },
  closeModalBtn: {
    marginTop: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  closeModalText: { color: "#8A8F9E", fontSize: 16, fontWeight: "600" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    flex: 1,
  },
  retryText: {
    color: "#3A75F2",
    fontSize: 12,
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
