import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLibrary,
  useBook,
  useBookInventory,
  useSimilarBooks,
  useBookReviews,
  Annotation,
} from "@/src/hooks/useLibrary";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAccountStatus } from "@/src/hooks/useAccountStatus";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { PDFReader } from "@/src/features/books/components/PDFReader";
import { SimilarBooks } from "@/src/features/books/components/SimilarBooks";
import { ai } from "@/src/core/ai";
import { AiSummaryModal } from "@/src/features/ai/AiSummaryModal";
import { DownloadButton } from "@/src/features/members/components/DownloadButton";
import { useReadingRoom } from "@/src/hooks/library/useReadingRoom";
import { useAnnotations } from "@/src/hooks/library/useMember";
import { FloatingReaction } from "@/src/features/members/components/FloatingReaction";
import { sync } from "@/src/core/sync";
import NetInfo from "@react-native-community/netinfo";
import { haptics } from "@/src/core/haptics";
import AnnotationLayer from "@/src/features/members/components/AnnotationLayer";
import { useTranslation } from "react-i18next";
import { PROVINCES_34 } from "@/src/constants/logistics";
import { logisticsAI } from "@/src/services/library/logisticsAI";
import { useUndoStore } from "@/src/store/useUndoStore";
import { mediaCache } from "@/src/core/mediaCache";
import {
  FALLBACK_BOOK_COVER,
  getBookCoverCacheId,
  resolveBookCoverUrl,
} from "@/src/core/mediaAssets";

export default function BookDetailPage() {
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const { reviews, borrows, canBorrow } = useLibrary();
  const { isLocked, lockReason } = useAccountStatus();

  const { data: book, isLoading: isBookLoading } = useBook(isbn!);
  const { data: bookReviews, isLoading: isReviewsLoading } = useBookReviews(
    isbn!,
  );
  const { data: similarBooks } = useSimilarBooks(isbn!);
  const { data: inventory } = useBookInventory(isbn!);
  const { mutate: postReview } = reviews.add;
  const mainCoverWidth = Math.min(160, Math.max(124, width * 0.38));
  const mainCoverHeight = mainCoverWidth * 1.5;
  const metaItemWidth = width < 420 ? "100%" : "47%";
  const similarCardWidth = Math.min(132, Math.max(108, width * 0.3));
  const similarCoverHeight = similarCardWidth * 1.5;

  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [showPDF, setShowPDF] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const queryClient = useQueryClient();
  const {
    readers,
    liveCount,
    reactions,
    isLoading: isReadersLoading,
    sendReaction,
  } = useReadingRoom(isbn!);
  const {
    annotations,
    addAnnotation,
    removeAnnotation,
    isLoading: isAnnotationsLoading,
  } = useAnnotations(isbn!);
  const [newAnnotation, setNewAnnotation] = useState("");
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [showAnnotationLayer, setShowAnnotationLayer] = useState(false);
  const [cachedCoverUri, setCachedCoverUri] = useState<string | null>(null);

  const handleBorrowRequest = async (branchId?: string) => {
    const targetBranch = branchId || selectedBranch;
    if (!targetBranch) {
      Alert.alert(t("common.error"), t("messages.select_branch_error"));
      return;
    }

    haptics.light();
    const check = canBorrow(book?.isbn || "");
    if (!check.allowed) {
      Alert.alert(t("common.error"), check.reason);
      return;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      await sync.addToQueue({
        type: "borrow",
        payload: {
          isbn: book?.isbn,
          branch_id: targetBranch,
          user_id: profile?.id,
        },
      });
      Alert.alert(
        t("common.offline_mode", "Chế độ ngoại tuyến"),
        t(
          "messages.borrow_queued_offline",
          "Yêu cầu mượn sách đã được lưu và sẽ tự động đồng bộ khi có mạng.",
        ),
      );
      return;
    }

    // Optimistic: show undo snackbar, commit borrow after timeout
    haptics.success();
    useUndoStore.getState().queueAction({
      message: t(
        "messages.borrow_pending",
        `Đang xử lý mượn "${book?.title}"...`,
      ),
      duration: 5000,
      onUndo: () => {
        haptics.light();
      },
      onCommit: async () => {
        return new Promise<void>((resolve, reject) => {
          borrows.borrowBook.mutate(
            { isbn: book?.isbn || "", branchId: targetBranch },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({
                  queryKey: ["branch_inventory", book?.isbn],
                });
                queryClient.invalidateQueries({
                  queryKey: ["book", book?.isbn],
                });
                resolve();
              },
              onError: (err: any) => {
                Alert.alert(t("common.error"), err.message);
                reject(err);
              },
            },
          );
        });
      },
    });
  };

  const handleSubmitReview = async () => {
    if (!profile) {
      Alert.alert(t("common.auth_required"), t("auth.login_to_review"));
      return;
    }
    if (userRating === 0) {
      Alert.alert(t("common.error"), t("messages.rating_required"));
      return;
    }

    setIsSubmitting(true);
    try {
      await (postReview as any).mutateAsync({
        book_isbn: isbn!,
        rating: userRating,
        comment: comment.trim(),
      });
      setUserRating(0);
      setComment("");
      Alert.alert(t("common.success"), t("messages.review_success"));
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("messages.review_failed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim()) return;
    setIsAddingAnnotation(true);
    try {
      await addAnnotation(newAnnotation.trim());
      setNewAnnotation("");
      Alert.alert(t("common.success"), t("messages.annotation_success"));
    } catch (error) {
      Alert.alert(t("common.error"), t("messages.annotation_failed"));
    } finally {
      setIsAddingAnnotation(false);
    }
  };

  const handleShowSummary = async () => {
    setShowSummaryModal(true);
    if (!summary) {
      setIsSummaryLoading(true);
      try {
        const text = await ai.getBookSummary(isbn!);
        setSummary(text);
      } catch (error) {
        console.error("Summary error:", error);
      } finally {
        setIsSummaryLoading(false);
      }
    }
  };

  useEffect(() => {
    let isActive = true;
    const sourceUrl = book ? resolveBookCoverUrl(book, "") : null;
    const cacheId = book ? getBookCoverCacheId(book) : isbn;

    setCachedCoverUri(null);

    if (!sourceUrl || !cacheId) {
      return () => {
        isActive = false;
      };
    }

    mediaCache
      .getCachedUri(cacheId, "BOOK_COVER", sourceUrl)
      .then((uri) => {
        if (isActive && uri) setCachedCoverUri(uri);
      })
      .catch((error) => {
        console.warn("[BookDetail] Cover cache lookup failed:", error);
      });

    mediaCache
      .cacheRemoteAsset({
        id: cacheId,
        type: "BOOK_COVER",
        title: book?.title || cacheId,
        url: sourceUrl,
      })
      .then((entry) => {
        if (isActive && entry?.uri) setCachedCoverUri(entry.uri);
      })
      .catch((error) => {
        console.warn("[BookDetail] Cover cache write failed:", error);
      });

    return () => {
      isActive = false;
    };
  }, [book, isbn]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(member)" as any);
  };

  const handleShare = async () => {
    if (!book) return;

    try {
      await Share.share({
        message: `Bạn đã xem cuốn sách "${book.title}" này chưa? Tìm đọc ngay tại BiblioTech nhé!\n\n${resolveBookCoverUrl(book, "") || ""}`,
        title: book.title,
      });
    } catch (error) {
      Alert.alert(
        t("common.error"),
        t("messages.share_failed", "Không thể chia sẻ sách lúc này."),
      );
    }
  };

  if (isBookLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F8EF7" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t("messages.book_not_found")}</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>{t("common.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayCoverUrl =
    cachedCoverUri || resolveBookCoverUrl(book, FALLBACK_BOOK_COVER);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Book Header with Image */}
        <View style={styles.bookHeader}>
          <LinearGradient
            colors={["rgba(15, 18, 29, 0.4)", "#0B0F1A"]}
            style={styles.headerGradient}
            pointerEvents="none"
          />
          {displayCoverUrl && (
            <Image
              source={{ uri: displayCoverUrl }}
              style={styles.blurBg}
              blurRadius={10}
              importantForAccessibility="no-hide-descendants"
            />
          )}

          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                style={styles.shareButton}
                accessibilityRole="button"
                accessibilityLabel="Chia sẻ sách"
              >
                <Ionicons name="share-social" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.bookInfoContainer} accessibilityRole="header">
              <View style={styles.coverShadow}>
                <Animated.Image
                  source={{ uri: displayCoverUrl }}
                  style={[
                    styles.mainCover,
                    { width: mainCoverWidth, height: mainCoverHeight },
                  ]}
                  resizeMode="contain"
                  accessibilityLabel={`Bìa sách ${book.title}`}
                />
              </View>
              <Animated.Text
                entering={FadeInDown.delay(300)}
                style={styles.title}
              >
                {book.title}
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.delay(400)}
                style={styles.author}
              >
                {book.author}
              </Animated.Text>

              <Animated.View
                entering={FadeInDown.delay(500)}
                style={styles.ratingSummary}
                accessibilityLabel={`Đánh giá trung bình ${book.average_rating?.toFixed(1) || "0.0"} sao từ ${book.ratings_count || 0} lượt.`}
              >
                <View
                  style={styles.starsRow}
                  importantForAccessibility="no-hide-descendants"
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={
                        s <= Math.round(book.average_rating || 0)
                          ? "star"
                          : "star-outline"
                      }
                      size={16}
                      color="#F59E0B"
                    />
                  ))}
                </View>
                <Text style={styles.ratingValue}>
                  {book.average_rating?.toFixed(1) || "0.0"}
                </Text>
                <Text style={styles.reviewCount}>
                  ({book.ratings_count || 0} đánh giá)
                </Text>
              </Animated.View>

              {liveCount > 0 && (
                <Animated.View
                  entering={FadeIn.delay(600)}
                  style={styles.readingRoomContainer}
                  accessibilityRole="text"
                  accessibilityLabel={`Có ${liveCount} người khác cũng đang đọc cuốn sách này cùng bạn.`}
                >
                  <View style={styles.avatarStack}>
                    {readers.slice(0, 3).map((reader, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.stackAvatar,
                          { zIndex: 10 - idx, marginLeft: idx === 0 ? 0 : -10 },
                        ]}
                      >
                        <Image
                          source={{
                            uri:
                              reader.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${reader.fullName}`,
                          }}
                          style={styles.stackAvatarImg}
                        />
                      </View>
                    ))}
                    {liveCount > 3 && (
                      <View
                        style={[
                          styles.stackAvatar,
                          styles.stackCount,
                          { marginLeft: -10, zIndex: 0 },
                        ]}
                      >
                        <Text style={styles.stackCountText}>
                          +{liveCount - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.readingRoomText}>
                    {liveCount === 1
                      ? `Bạn đang đọc cùng 1 người khác`
                      : `Bạn đang đọc cùng ${liveCount} người khác`}
                  </Text>
                </Animated.View>
              )}

              <View style={styles.reactionButtonsRow}>
                <TouchableOpacity
                  style={styles.reactionBtn}
                  onPress={() => {
                    haptics.light();
                    sendReaction("SPARKLES");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Gửi cảm xúc Lấp lánh"
                  accessibilityHint="Nhấn để gửi hiệu ứng lấp lánh cho những người đang đọc cùng"
                >
                  <Text style={styles.reactionEmoji}>✨</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reactionBtn}
                  onPress={() => {
                    haptics.light();
                    sendReaction("MIND_BLOWN");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Gửi cảm xúc Kinh ngạc"
                  accessibilityHint="Nhấn để gửi hiệu ứng nổ tung cho những người đang đọc cùng"
                >
                  <Text style={styles.reactionEmoji}>🤯</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {reactions.map((reaction) => (
          <FloatingReaction
            key={reaction.id}
            type={reaction.type}
            x={reaction.x}
          />
        ))}

        <View style={styles.detailsSection}>
          <View style={styles.tabsContainer}>
            {["description", "annotations", "appendix", "details"].map(
              (tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, activeTab === tab && styles.activeTab]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                      style={[
                        styles.tabText,
                        activeTab === tab && styles.activeTabText,
                      ]}
                    >
                      {t(`metadata.tabs.${tab}`)}
                    </Text>
                    {tab === "annotations" && annotations.length > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>
                          {annotations.length}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ),
            )}
          </View>

          {activeTab === "description" ? (
            <Text style={styles.description}>
              {book.description || t("metadata.empty.description")}
            </Text>
          ) : activeTab === "annotations" ? (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={styles.annotationsContainer}
            >
              <View style={styles.addAnnotationBox}>
                <TextInput
                  style={styles.annotationInput}
                  placeholder={t("metadata.empty.annotations_placeholder")}
                  placeholderTextColor="#5A5F7A"
                  value={newAnnotation}
                  onChangeText={setNewAnnotation}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.postAnnotationBtn,
                    !newAnnotation.trim() && styles.postAnnotationDisabled,
                  ]}
                  onPress={handleAddAnnotation}
                  disabled={!newAnnotation.trim() || isAddingAnnotation}
                >
                  {isAddingAnnotation ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="send" size={18} color="white" />
                  )}
                </TouchableOpacity>
              </View>

              {annotations.length > 0 ? (
                <>
                  {annotations.slice(0, 3).map((note: Annotation) => (
                    <View key={note.id} style={styles.annotationItem}>
                      <View style={styles.annotationHeader}>
                        <Image
                          source={{
                            uri:
                              note.user?.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${note.user?.fullName}`,
                          }}
                          style={styles.annotationAvatar}
                        />
                        <View style={styles.annotationInfo}>
                          <Text style={styles.annotationUser}>
                            {note.user?.fullName}
                          </Text>
                          <Text style={styles.annotationDate}>
                            {new Date(note.created_at).toLocaleDateString(
                              "vi-VN",
                            )}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.annotationContent,
                          { borderLeftColor: note.color || "#3A75F2" },
                        ]}
                      >
                        <Text style={styles.annotationText}>
                          {note.content}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.viewAllAnnotationsBtn}
                    onPress={() => setShowAnnotationLayer(true)}
                  >
                    <Text style={styles.viewAllAnnotationsText}>
                      {t(
                        "metadata.empty.view_all_annotations",
                        "Xem tất cả ghi chú",
                      )}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#3A75F2"
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptyAnnotations}>
                  <Ionicons name="create-outline" size={48} color="#1E2540" />
                  <Text style={styles.emptyAnnotationsText}>
                    {t("metadata.empty.annotations")}
                  </Text>
                </View>
              )}
            </Animated.View>
          ) : activeTab === "appendix" ? (
            <Text style={styles.description}>
              {book.appendix || t("metadata.empty.appendix")}
            </Text>
          ) : (
            <View style={styles.metaGrid}>
              <View
                style={[styles.metaItem, { width: metaItemWidth }]}
                accessibilityLabel={`ISBN: ${book.isbn}`}
              >
                <Text style={styles.metaLabel}>ISBN</Text>
                <Text style={styles.metaValue}>{book.isbn}</Text>
              </View>
              <View
                style={[styles.metaItem, { width: metaItemWidth }]}
                accessibilityLabel={`Thể loại: ${book.category ? t("categories." + book.category, book.category) : "Chưa xác định"}`}
              >
                <Text style={styles.metaLabel}>
                  {t("common.category", "Thể loại")}
                </Text>
                <Text style={styles.metaValue}>
                  {book.category
                    ? String(t("categories." + book.category, book.category))
                    : "N/A"}
                </Text>
              </View>
              <View
                style={[styles.metaItem, { width: metaItemWidth }]}
                accessibilityLabel={`${t("metadata.language")}: ${book.language || t("languages.vi")}`}
              >
                <Text style={styles.metaLabel}>{t("metadata.language")}</Text>
                <Text style={styles.metaValue}>
                  {book.language?.toUpperCase() || "VN"}
                </Text>
              </View>
              <View
                style={[styles.metaItem, { width: metaItemWidth }]}
                accessibilityLabel={`${t("metadata.page_count")}: ${book.page_count || t("common.loading")}`}
              >
                <Text style={styles.metaLabel}>{t("metadata.page_count")}</Text>
                <Text style={styles.metaValue}>{book.page_count || "N/A"}</Text>
              </View>
            </View>
          )}

          <View style={styles.branchSection}>
            <Text style={styles.sectionTitle}>
              {t("librarian.branch_inventory_status")}
            </Text>
            {inventory?.map((bi: any) => {
              const province = PROVINCES_34.find(
                (p) => p.id === bi.branches?.province_v2_id,
              );
              const isOutOfStock = bi.available_copies <= 0;

              return (
                <View
                  key={bi.branch_id}
                  style={[
                    styles.branchCard,
                    isOutOfStock && { opacity: 0.6, borderColor: "#333" },
                    selectedBranch === bi.branch_id &&
                      styles.selectedBranchCard,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "700",
                          fontSize: 15,
                        }}
                      >
                        {bi.branches?.name}
                      </Text>
                      {province && (
                        <View style={styles.regionBadge}>
                          <Text style={styles.regionBadgeText}>
                            {province.region.replace("_", " ")}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ color: "#8B8FA3", fontSize: 12, marginTop: 2 }}
                    >
                      {bi.branches?.location}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: !isOutOfStock ? "#10B981" : "#EF4444",
                        fontWeight: "800",
                        fontSize: 16,
                      }}
                    >
                      {!isOutOfStock
                        ? `${bi.available_copies} ${t("common.copies")}`
                        : t("member.out_of_stock")}
                    </Text>

                    {!isOutOfStock ? (
                      <TouchableOpacity
                        style={[
                          styles.selectBranchBtn,
                          selectedBranch === bi.branch_id &&
                            styles.selectedBranchBtnActive,
                        ]}
                        onPress={() => {
                          if (selectedBranch === bi.branch_id) {
                            // If already selected, trigger borrow directly
                            handleBorrowRequest(bi.branch_id);
                          } else {
                            setSelectedBranch(bi.branch_id);
                            haptics.light();
                          }
                        }}
                      >
                        <Text style={styles.selectBranchBtnText}>
                          {selectedBranch === bi.branch_id
                            ? t("common.confirm")
                            : t("member.borrow_books")}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.transferRequestBtn}
                        onPress={() => {
                          const suggestion = logisticsAI.suggestTransfer(
                            { ...book, branch_inventory: inventory },
                            province?.id || 0,
                          );
                          if (suggestion) {
                            const isNational =
                              suggestion.distanceTier === "NATIONAL";
                            const isPlatinum =
                              profile?.membershipType === "PLATINUM";
                            const fee =
                              isNational && !isPlatinum
                                ? "30,000 VND"
                                : "Miễn phí";
                            const time = isNational ? "3-5 ngày" : "24h-48h";

                            Alert.alert(
                              isNational
                                ? "Yêu cầu Toàn quốc"
                                : "Yêu cầu Điều phối",
                              `Chúng tôi sẽ chuyển sách từ ${suggestion.fromBranchName} (${suggestion.region.replace("_", " ")}) về đây.\n\n• Phí vận chuyển: ${fee}\n• Thời gian dự kiến: ${time}\n\nBạn có muốn đặt trước không?`,
                              [
                                { text: "Để sau", style: "cancel" },
                                {
                                  text: "Yêu cầu ngay",
                                  onPress: () => {
                                    haptics.success();
                                    setSelectedBranch(bi.branch_id);
                                  },
                                },
                              ],
                            );
                          } else {
                            Alert.alert(
                              "Thông báo",
                              t("messages.out_of_stock_all_branches"),
                            );
                          }
                        }}
                      >
                        <Text style={styles.transferRequestText}>
                          {t("admin.transfer_now")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.borrowContainer}>
            <TouchableOpacity
              style={[
                styles.borrowBtn,
                (book.available_copies <= 0 || isLocked || !selectedBranch) &&
                  styles.disabledBtn,
              ]}
              onPress={() => handleBorrowRequest()}
              disabled={
                book.available_copies <= 0 || isLocked || !selectedBranch
              }
              accessibilityRole="button"
              accessibilityLabel={
                selectedBranch
                  ? t(
                      "member.borrow_branch_selected",
                      "Mượn sách tại chi nhánh đã chọn",
                    )
                  : t("member.please_select_branch", "Vui lòng chọn chi nhánh")
              }
            >
              <Text style={styles.borrowBtnText}>
                {isLocked
                  ? t("auth.account_locked")
                  : !selectedBranch
                    ? t("member.select_branch_to_borrow")
                    : t("member.request_borrow")}
              </Text>
            </TouchableOpacity>

            {(book as any).pdf_url ? (
              <TouchableOpacity
                style={[styles.pdfBtn, isLocked && styles.disabledBtn]}
                onPress={() => setShowPDF(true)}
                disabled={isLocked}
              >
                <Ionicons
                  name="book-outline"
                  size={20}
                  color="white"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.borrowBtnText}>
                  {t("member.read_ebook", "Đọc sách điện tử (E-Book)")}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.annotationActionBtn}
              onPress={() => {
                haptics.light();
                setShowAnnotationLayer(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("community.activity")}
              accessibilityHint={t(
                "community.activity_hint",
                "Mở lớp thảo luận cộng đồng và ghi chú cá nhân cho sách này",
              )}
            >
              <LinearGradient
                colors={["#8B5CF6", "#6D28D9"]}
                style={styles.aiGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={20}
                  color="white"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.borrowBtnText}>
                  {t("community.activity")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiSummaryBtn}
              onPress={() => {
                haptics.light();
                handleShowSummary();
              }}
              accessibilityRole="button"
              accessibilityLabel={t("member.ai_summary")}
              accessibilityHint={t(
                "member.ai_summary_hint",
                "Sử dụng trí tuệ nhân tạo để xem tóm tắt nội dung chính của sách",
              )}
            >
              <LinearGradient
                colors={["#3A75F2", "#4F8EF7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.aiSummaryBtnGradient}
              >
                <Ionicons
                  name="sparkles"
                  size={20}
                  color="white"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.borrowBtnText}>
                  {t("member.ai_summary")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.downloadRow}>
              {(book as any).pdf_url && (
                <DownloadButton
                  id={book.isbn}
                  title={book.title}
                  url={(book as any).pdf_url}
                  type="EPUB"
                />
              )}
              {/* If it was an audiobook, we'd add an MP3 download button here too */}
            </View>
          </View>
        </View>

        <SimilarBooks currentBook={book} />

        {showPDF && (book as any).pdf_url ? (
          <View style={StyleSheet.absoluteFill}>
            <PDFReader
              url={(book as any).pdf_url}
              title={book.title}
              isbn={isbn!}
              onClose={() => setShowPDF(false)}
            />
          </View>
        ) : null}

        {/* AI Recommendations */}
        {similarBooks && similarBooks.length > 0 ? (
          <View style={styles.recommendationsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("member.similar_books")}
              </Text>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={12} color="#4F8EF7" />
                <Text style={styles.aiBadgeText}>AI Powered</Text>
              </View>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={similarBooks}
              keyExtractor={(item) => item.isbn}
              contentContainerStyle={styles.recommendationList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.similarBookCard, { width: similarCardWidth }]}
                  onPress={() => router.push(`/book/${item.isbn}`)}
                >
                  <Image
                    source={{
                      uri: resolveBookCoverUrl(item, FALLBACK_BOOK_COVER),
                    }}
                    style={[
                      styles.similarCover,
                      { width: similarCardWidth, height: similarCoverHeight },
                    ]}
                    resizeMode="contain"
                  />
                  <Text style={styles.similarTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.similarAuthor} numberOfLines={1}>
                    {item.author}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>{t("messages.your_review")}</Text>
          <View style={styles.ratingInputCard}>
            <View
              style={styles.starsInputRow}
              accessibilityLabel="Chọn mức đánh giá từ 1 đến 5 sao"
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setUserRating(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s} sao`}
                  accessibilityState={{ selected: userRating === s }}
                >
                  <Ionicons
                    name={s <= userRating ? "star" : "star-outline"}
                    size={32}
                    color="#F59E0B"
                    style={{ marginHorizontal: 4 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.commentInput}
              placeholder={t("messages.write_review_placeholder")}
              placeholderTextColor="#5A5F7A"
              multiline
              value={comment}
              onChangeText={setComment}
              accessibilityLabel="Nội dung bình luận"
              accessibilityHint="Nhập nhận xét của bạn về cuốn sách tại đây"
            />
            <TouchableOpacity
              onPress={handleSubmitReview}
              style={[
                styles.submitBtn,
                (isSubmitting || !profile) && styles.disabledBtn,
              ]}
              disabled={isSubmitting || !profile}
              accessibilityRole="button"
              accessibilityLabel="Gửi đánh giá"
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {t("messages.submit_review")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Reviews List */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>
            {t("messages.community_reviews")}
          </Text>
          {isReviewsLoading ? (
            <ActivityIndicator color="#4F8EF7" />
          ) : bookReviews && bookReviews.length > 0 ? (
            bookReviews.map((review: any) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {(review as any).profiles?.fullName?.charAt(0) || "U"}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.reviewerName}>
                        {(review as any).profiles?.fullName ||
                          "Người dùng ẩn danh"}
                      </Text>
                      <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString(
                          "vi-VN",
                        )}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.smallStarsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= review.rating ? "star" : "star-outline"}
                        size={12}
                        color="#F59E0B"
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyReviews}>
              {t("messages.no_reviews_yet")}
            </Text>
          )}
        </View>
      </ScrollView>

      <AiSummaryModal
        visible={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        summary={summary}
        loading={isSummaryLoading}
        bookTitle={book.title}
      />

      <AnnotationLayer
        isVisible={showAnnotationLayer}
        onClose={() => setShowAnnotationLayer(false)}
        bookIsbn={isbn!}
        bookTitle={book.title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
    padding: 20,
  },
  errorText: { color: "#8B8FA3", fontSize: 16, marginBottom: 20 },
  backBtn: {
    backgroundColor: "#4F8EF7",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { color: "white", fontWeight: "bold" },
  bookHeader: { height: 450, overflow: "hidden", position: "relative" },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.3,
    zIndex: 0,
  },
  headerGradient: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  headerContent: {
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    position: "relative",
    zIndex: 2,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
    zIndex: 5,
    elevation: 5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 6,
    elevation: 6,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 6,
    elevation: 6,
  },
  bookInfoContainer: { alignItems: "center", marginTop: 20 },
  coverShadow: {
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  mainCover: { borderRadius: 12 },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 20,
    textAlign: "center",
  },
  author: { color: "#8B8FA3", fontSize: 16, marginTop: 4 },
  ratingSummary: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  starsRow: { flexDirection: "row", marginRight: 8 },
  ratingValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 4,
  },
  reviewCount: { color: "#5A5F7A", fontSize: 13 },
  readingRoomContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "rgba(58, 117, 242, 0.2)",
  },
  selectedBranchBtnActive: {
    backgroundColor: "#3A75F2",
    borderColor: "#3A75F2",
  },
  errorBackBtn: {
    backgroundColor: "#3A75F2",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  avatarStack: {
    flexDirection: "row",
    marginRight: 10,
  },
  stackAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#0B0F1A",
    overflow: "hidden",
  },
  stackAvatarImg: {
    width: "100%",
    height: "100%",
  },
  stackCount: {
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
  },
  stackCountText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
  },
  readingRoomText: {
    color: "#3A75F2",
    fontSize: 12,
    fontWeight: "600",
  },
  reactionButtonsRow: {
    flexDirection: "row",
    marginTop: 15,
    gap: 12,
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  reactionEmoji: {
    fontSize: 20,
  },
  detailsSection: { padding: 24 },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#151929",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#3A75F2",
  },
  tabText: {
    color: "#8B8FA3",
    fontSize: 13,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  description: { color: "#8B8FA3", fontSize: 15, lineHeight: 22 },
  borrowContainer: { marginTop: 24 },
  borrowBtn: {
    backgroundColor: "#3A75F2",
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  pdfBtn: {
    backgroundColor: "#10B981",
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
  },
  borrowBtnText: { color: "white", fontWeight: "800", fontSize: 16 },
  aiSummaryBtn: {
    height: 54,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  aiSummaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 24, gap: 16 },
  metaItem: {
    backgroundColor: "#151929",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  metaLabel: {
    color: "#5A5F7A",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metaValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  ratingSection: { padding: 24, paddingTop: 0 },
  ratingInputCard: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  starsInputRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  commentInput: {
    backgroundColor: "#0B0F1A",
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  submitBtn: {
    backgroundColor: "#4F8EF7",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  submitBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  disabledBtn: { opacity: 0.6 },
  reviewsSection: { padding: 24, paddingTop: 0, paddingBottom: 60 },
  reviewCard: {
    backgroundColor: "#151929",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reviewerInfo: { flexDirection: "row", alignItems: "center" },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "white", fontWeight: "bold" },
  reviewerName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  reviewDate: { color: "#5A5F7A", fontSize: 11, marginTop: 2 },
  smallStarsRow: { flexDirection: "row" },
  reviewComment: { color: "#8B8FA3", fontSize: 14, lineHeight: 20 },
  emptyReviews: { color: "#5A5F7A", textAlign: "center", marginTop: 10 },
  branchSection: { marginTop: 24 },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151929",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  selectedBranchCard: {
    borderColor: "#3A75F2",
    backgroundColor: "rgba(58, 117, 242, 0.1)",
  },
  regionBadge: {
    backgroundColor: "rgba(58, 117, 242, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  regionBadgeText: {
    color: "#3A75F2",
    fontSize: 10,
    fontWeight: "700",
  },
  selectBranchBtn: {
    marginTop: 8,
    backgroundColor: "#3A75F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selectBranchBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  transferRequestBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#3A75F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  transferRequestText: {
    color: "#3A75F2",
    fontSize: 12,
    fontWeight: "700",
  },
  recommendationsSection: {
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: "#1E2540",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F8EF720",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginBottom: 12,
  },
  aiBadgeText: {
    color: "#4F8EF7",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  recommendationList: {
    paddingHorizontal: 20,
  },
  similarBookCard: {
    marginRight: 16,
  },
  similarCover: {
    borderRadius: 12,
    backgroundColor: "#151929",
  },
  similarTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 18,
  },
  similarAuthor: {
    color: "#8B8FA3",
    fontSize: 12,
    marginTop: 2,
  },
  aiSummarySection: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#3A75F240",
    borderStyle: "dashed",
  },
  aiSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  aiSummaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(79, 142, 247, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  aiSummaryTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  aiSummaryBadge: {
    backgroundColor: "#3A75F2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  aiSummaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  aiSummaryDesc: {
    color: "#8B8FA3",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  aiSummaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  aiSummaryAction: {
    color: "#4F8EF7",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 4,
  },
  downloadRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  tabBadge: {
    backgroundColor: "#3A75F2",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  annotationsContainer: {
    marginTop: 10,
  },
  addAnnotationBox: {
    flexDirection: "row",
    backgroundColor: "#171B2B",
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1F263B",
    alignItems: "flex-end",
  },
  annotationInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    maxHeight: 100,
    paddingTop: 0,
  },
  postAnnotationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3A75F2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  postAnnotationDisabled: {
    backgroundColor: "#1E2540",
    opacity: 0.5,
  },
  annotationItem: {
    backgroundColor: "#171B2B",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  annotationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  annotationAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1F263B",
  },
  annotationInfo: {
    flex: 1,
    marginLeft: 10,
  },
  annotationUser: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  annotationDate: {
    color: "#5A5F7A",
    fontSize: 11,
    marginTop: 1,
  },
  annotationContent: {
    borderLeftWidth: 3,
    paddingLeft: 12,
  },
  annotationSelection: {
    color: "#8A8F9E",
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 8,
    backgroundColor: "rgba(58, 117, 242, 0.05)",
    padding: 4,
  },
  annotationText: {
    color: "#E2E8F0",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyAnnotations: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyAnnotationsText: {
    color: "#5A5F7A",
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    maxWidth: "80%",
  },
  viewAllAnnotationsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllAnnotationsText: {
    color: "#3A75F2",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  annotationActionBtn: {
    height: 54,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  aiGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
});
