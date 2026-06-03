import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import { AnimatedWrapper } from "@/src/components/AnimatedWrapper";
import { Book } from "@/src/hooks/library/types";
import { useMetadataSettings } from "@/src/hooks/useMetadataSettings";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { mediaCache } from "@/src/core/mediaCache";
import {
  getBookCoverCacheId,
  getBookCoverCandidates,
} from "@/src/core/mediaAssets";

interface BookItemProps {
  item: Book;
  index?: number;
  onPress?: (item: Book) => void;
  onEdit?: (item: Book) => void;
  onDelete?: (item: Book) => void;
  onRatingPress?: (item: Book) => void;
  showActions?: boolean;
  visibleFields?: string[];
  badge?: React.ReactNode;
}

export const BookItem: React.FC<BookItemProps> = React.memo(
  ({
    item,
    index,
    onPress,
    onEdit,
    onDelete,
    onRatingPress,
    showActions = false,
    visibleFields,
    badge,
  }) => {
    const { t } = useTranslation();
    const { isVisible } = useMetadataSettings();
    const gData = item.google_data || {};

    const title = item.title || gData.title || "Untitled";
    const author = item.author || gData.authors?.join(", ") || "Unknown Author";
    const pageCount = item.page_count || gData.pageCount;
    const rating = item.average_rating || gData.averageRating || 0;
    const ratingCount = item.ratings_count || gData.ratingsCount;
    const category = item.category || gData.categories?.[0];
    const description = item.description || gData.description;
    const publishedDate = item.published_date || gData.publishedDate;
    const language = item.language || gData.language;
    const appendix = item.appendix;

    const fallbackCover = require("@/assets/images/icon.png");
    const coverCandidates = useMemo(() => getBookCoverCandidates(item), [item]);
    const [candidateIndex, setCandidateIndex] = useState(0);
    const [imgSrc, setImgSrc] = useState<ImageSourcePropType>(fallbackCover);

    useEffect(() => {
      setCandidateIndex(0);
    }, [coverCandidates[0]]);

    useEffect(() => {
      let isActive = true;
      const sourceUrl = coverCandidates[candidateIndex];

      if (!sourceUrl) {
        setImgSrc(fallbackCover);
        return () => {
          isActive = false;
        };
      }

      setImgSrc({ uri: sourceUrl });

      const cacheId = getBookCoverCacheId(item);
      mediaCache
        .getCachedUri(cacheId, "BOOK_COVER", sourceUrl)
        .then((uri) => {
          if (isActive && uri) setImgSrc({ uri });
        })
        .catch((error) => {
          console.warn("[BookItem] Cover cache lookup failed:", error);
        });

      mediaCache
        .cacheRemoteAsset({
          id: cacheId,
          type: "BOOK_COVER",
          title,
          url: sourceUrl,
        })
        .then((entry) => {
          if (isActive && entry?.uri) setImgSrc({ uri: entry.uri });
        })
        .catch((error) => {
          console.warn("[BookItem] Cover cache write failed:", error);
        });

      return () => {
        isActive = false;
      };
    }, [candidateIndex, coverCandidates, fallbackCover, item, title]);

    const handleImgError = () => {
      if (candidateIndex < coverCandidates.length - 1) {
        setCandidateIndex((current) => current + 1);
        return;
      }

      setImgSrc(fallbackCover);
    };

    const aLabel = `${title}, ${t("common.author", "tác giả")} ${author}. ${category ? `${t("common.genre", "Thể loại")} ${t("categories." + category, category)}.` : ""} ${rating > 0 ? `${t("common.rating", "Đánh giá")} ${rating.toFixed(1)} ${t("common.stars", "sao")}.` : t("common.no_rating", "Chưa có đánh giá.")}`;

    return (
      <AnimatedWrapper index={index} delay={50} style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.recordCard}
          onPress={() => onPress?.(item)}
          disabled={!onPress}
          accessibilityRole="button"
          accessibilityLabel={aLabel}
          accessibilityHint={
            onPress
              ? t("common.click_to_view", "Nhấn để xem chi tiết hoặc mượn sách")
              : ""
          }
        >
          <View
            style={styles.recordThumbContainer}
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.Image
              {...({ sharedTransitionTag: `cover-${item.isbn}` } as any)}
              source={imgSrc}
              style={styles.recordThumb}
              onError={handleImgError}
              resizeMode="contain"
              accessibilityLabel={`${t("common.book_cover", "Bìa sách")} ${title}`}
            />
            <LinearGradient
              colors={[
                "rgba(255,255,255,0.15)",
                "transparent",
                "rgba(0,0,0,0.5)",
              ]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glossyOverlay} />
          </View>

          <View style={styles.recordInfo}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordBookTitle} numberOfLines={2}>
                  {title}
                </Text>
                {badge}
              </View>
              {(visibleFields
                ? visibleFields.includes("isbn")
                : isVisible("isbn")) && (
                <Text
                  style={styles.isbnText}
                  accessibilityLabel={`ISBN: ${item.isbn}`}
                >
                  {item.isbn}
                </Text>
              )}
            </View>
            <Text style={styles.recordAuthor} numberOfLines={1}>
              {author}
            </Text>

            <View style={styles.metaBadgeRow}>
              {(visibleFields
                ? visibleFields.includes("page_count")
                : isVisible("page_count")) && pageCount ? (
                <View
                  style={styles.metaBadge}
                  accessibilityLabel={`${pageCount} ${t("common.pages", "trang")}`}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={12}
                    color="#8B8FA3"
                  />
                  <Text style={styles.metaText}>
                    {pageCount} {t("common.pages_lower", "pages")}
                  </Text>
                </View>
              ) : null}

              {(visibleFields
                ? visibleFields.includes("average_rating")
                : isVisible("average_rating")) && (
                <TouchableOpacity
                  onPress={() => onRatingPress?.(item)}
                  activeOpacity={0.6}
                  style={styles.ratingRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("common.rating", "Đánh giá")} ${rating.toFixed(1)} ${t("common.stars", "sao")} ${t("common.from", "từ")} ${ratingCount || 0} ${t("common.reviews", "lượt")}.`}
                  accessibilityHint={t(
                    "common.click_to_view_rating",
                    "Nhấn để xem đánh giá chi tiết",
                  )}
                >
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.ratingText}>
                    {rating > 0
                      ? rating.toFixed(1)
                      : t("common.no_rating", "Chưa có đánh giá")}
                  </Text>
                  {ratingCount && (
                    <Text style={styles.ratingCount}>({ratingCount})</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {showActions && (
              <View
                style={styles.badge}
                accessibilityLabel={`${t("common.quantity", "Số lượng")}: ${t("common.remaining", "còn")} ${item.available_copies} ${t("common.on_total", "trên tổng số")} ${item.total_copies} ${t("common.copies_lower", "cuốn")}.`}
              >
                <Text style={styles.badgeText}>
                  {item.available_copies} / {item.total_copies}{" "}
                  {t("common.available_status", "AVAILABLE")}
                </Text>
              </View>
            )}

            {(visibleFields
              ? visibleFields.includes("category") ||
                visibleFields.includes("published_date") ||
                visibleFields.includes("language")
              : isVisible("category") ||
                isVisible("published_date") ||
                isVisible("language")) && (
              <View style={styles.metaRow}>
                {(visibleFields
                  ? visibleFields.includes("category")
                  : isVisible("category")) &&
                  category && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        {String(t("categories." + category, category))}
                      </Text>
                    </View>
                  )}
                {(visibleFields
                  ? visibleFields.includes("published_date")
                  : isVisible("published_date")) &&
                  publishedDate && (
                    <Text style={styles.yearText}>
                      • {publishedDate.substring(0, 4)}
                    </Text>
                  )}
                {(visibleFields
                  ? visibleFields.includes("language")
                  : isVisible("language")) &&
                  language && (
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: "rgba(16, 185, 129, 0.1)" },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: "#10B981" }]}>
                        {language.toUpperCase()}
                      </Text>
                    </View>
                  )}
              </View>
            )}

            {(visibleFields
              ? visibleFields.includes("description")
              : isVisible("description")) &&
              description && (
                <Text style={styles.description} numberOfLines={2}>
                  {description}
                </Text>
              )}

            {(visibleFields
              ? visibleFields.includes("appendix")
              : isVisible("appendix")) &&
              appendix && (
                <View style={styles.appendixContainer}>
                  <Text style={styles.appendixLabel}>
                    {t("common.appendix", "Phụ lục")}:
                  </Text>
                  <Text style={styles.appendixText} numberOfLines={1}>
                    {appendix}
                  </Text>
                </View>
              )}

            {(visibleFields
              ? visibleFields.includes("edition")
              : isVisible("edition")) &&
              item.edition && (
                <Text style={styles.editionText}>
                  {t("common.edition", "Phiên bản")}: {item.edition}
                </Text>
              )}
          </View>

          {showActions && (
            <View style={styles.recordActions}>
              <TouchableOpacity
                onPress={() => onEdit?.(item)}
                style={styles.actionBtnIcon}
                accessibilityRole="button"
                accessibilityLabel={t(
                  "common.edit_book_info",
                  "Sửa thông tin sách",
                )}
              >
                <Ionicons name="create-outline" size={18} color="#4F8EF7" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete?.(item)}
                style={[styles.actionBtnIcon, { marginTop: 8 }]}
                accessibilityRole="button"
                accessibilityLabel={t("common.delete_book", "Xóa sách")}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </AnimatedWrapper>
    );
  },
);

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 0,
  },
  recordCard: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
    flexDirection: "row",
    alignItems: "center",
  },
  recordThumbContainer: {
    width: 70,
    height: 100,
    backgroundColor: "#1E2540",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 3,
  },
  recordThumb: {
    width: "100%",
    height: "100%",
  },
  glossyOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  recordInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  isbnText: {
    color: "#3A75F2",
    fontSize: 10,
    fontWeight: "700",
    opacity: 0.8,
  },
  recordBookTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
    flex: 1,
  },
  recordAuthor: {
    color: "#8B8FA3",
    fontSize: 13,
    marginTop: 4,
  },
  metaBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: "#5A5F7A",
    fontSize: 12,
  },
  badge: {
    backgroundColor: "rgba(79, 142, 247, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#4F8EF7",
    fontSize: 10,
    fontWeight: "800",
  },
  recordActions: {
    justifyContent: "center",
    paddingLeft: 12,
  },
  actionBtnIcon: {
    width: 36,
    height: 36,
    backgroundColor: "#1E2540",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  tag: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    color: "#A855F7",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  yearText: {
    color: "#5A5F7A",
    fontSize: 11,
    fontWeight: "600",
  },
  description: {
    color: "#8B8FA3",
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
    fontStyle: "italic",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "700",
  },
  ratingCount: {
    color: "#5A5F7A",
    fontSize: 11,
  },
  editionText: {
    color: "#3D4260",
    fontSize: 10,
    marginTop: 4,
    fontWeight: "600",
  },
  appendixContainer: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  appendixLabel: {
    color: "#4F8EF7",
    fontSize: 11,
    fontWeight: "700",
  },
  appendixText: {
    color: "#8B8FA3",
    fontSize: 11,
    flex: 1,
  },
});
