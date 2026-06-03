import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  FadeInUp,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useLibrary, Book } from "../../src/hooks/useLibrary";
import { BookItem } from "../../src/features/books/components/BookItem";
import { supabase } from "../../src/api/supabase";
import { useAccountStatus } from "../../src/hooks/useAccountStatus";
import { ai } from "../../src/core/ai";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useUndoStore } from "../../src/store/useUndoStore";
import { InlineUndoButton } from "../../src/components/InlineUndoButton";
import {
  FALLBACK_BOOK_COVER,
  resolveBookCoverUrl,
} from "../../src/core/mediaAssets";

const AnimatedVoiceWave = ({ index }: { index: number }) => {
  const scaleY = useSharedValue(1);

  React.useEffect(() => {
    scaleY.value = withRepeat(
      withSequence(
        withTiming(1.5 + Math.random(), {
          duration: 500 + Math.random() * 500,
        }),
        withTiming(0.8, { duration: 500 + Math.random() * 500 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
    opacity: interpolate(scaleY.value, [0.8, 2], [0.5, 1]),
  }));

  return (
    <Animated.View
      style={[
        styles.voiceWave,
        animatedStyle,
        { backgroundColor: index % 2 === 0 ? "#3A75F2" : "#4F8EF7" },
      ]}
    />
  );
};

export default function SearchPage() {
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ openFilter?: string }>();
  const router = useRouter();
  const { books, borrows } = useLibrary();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (params.openFilter === "true") {
      setIsFilterModalVisible(true);
    }
  }, [params.openFilter]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const { data: allBooks, isLoading } = books.list();
  const horizontalPadding = width < 420 ? 16 : 24;
  const modalMaxHeight = Math.min(height * 0.82, 680);
  const aiModalHeight = Math.min(height * 0.75, 620);
  const voiceCardWidth = Math.min(Math.max(width - 48, 220), 250);

  // Advanced Filters State
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isAvailableOnly, setIsAvailableOnly] = useState(false);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<Book[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState<any | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isListening) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 400 }),
          withTiming(1, { duration: 400 }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1);
    }
  }, [isListening]);

  const micAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: interpolate(pulse.value, [1, 1.2], [0, 0.3]),
  }));

  const years = ["2025", "2024", "2023", "2022", "2021", "2020", "before_2020"];
  const languagesList = ["vi", "en", "ja", "fr"];

  const defaultCategories = [
    "Business & Economics",
    "Fiction",
    "Computers",
    "Skills",
    "Children's Books",
    "Foreign Language Study",
    "Psychology",
  ];
  const availableCategories = useMemo(() => {
    const raw = Array.from(
      new Set([
        ...defaultCategories,
        ...((allBooks || [])
          .map((b: any) => b.category)
          .filter(Boolean) as string[]),
      ]),
    );

    // Use a map to deduplicate by translated label to avoid showing "Fiction" and "Tiểu thuyết" twice
    const uniqueMap = new Map<string, string>();
    raw.forEach((cat) => {
      const label = t(`categories.${cat}`).toLowerCase();
      if (!uniqueMap.has(label)) {
        uniqueMap.set(label, cat);
      }
    });

    return Array.from(uniqueMap.values()).sort();
  }, [allBooks, t]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (isSemanticSearch && searchQuery.trim()) {
        performSemanticSearch(searchQuery);
      } else if (isSemanticSearch && !searchQuery.trim()) {
        // Clear results when query is cleared
        setSemanticResults([]);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, isSemanticSearch]);

  const performSemanticSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const results = await books.semanticSearchMutation.mutateAsync({
        query,
        limit: 10,
      });
      setSemanticResults(results || []);
    } catch (error) {
      Alert.alert(t("common.error"), t("messages.semantic_search_failed"));
    } finally {
      setIsSearching(false);
    }
  };

  const startListening = async () => {
    try {
      const { Audio } = await import("expo-av");
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

        // Simulate voice processing after 2 seconds
        setTimeout(async () => {
          await stopListening(true);
        }, 2500);
      } else {
        Alert.alert(
          t("common.permissions"),
          t("messages.mic_permission_required"),
        );
      }
    } catch (err) {
      // Failed to start recording
    }
  };

  const stopListening = async (shouldProcess = false) => {
    setIsListening(false);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      if (shouldProcess) {
        setIsProcessingVoice(true);
        // In a real app, you'd send the audio file to a transcription service
        // Here we simulate the transcription then call our AI service
        const mockPhrases = [
          t("search.voice_phrase_6"), // "Tìm sách trinh thám"
          t("search.voice_phrase_7"), // "Gợi ý sách Harry Potter"
          t("search.voice_phrase_5"), // "Sách nào hay về khởi nghiệp?"
          t("search.voice_phrase_4"), // "Đắc nhân tâm"
        ];
        const transcript =
          mockPhrases[Math.floor(Math.random() * mockPhrases.length)];

        const result = await ai.processVoiceCommand(transcript);
        setAiResponse(result);
        setShowAiModal(true);

        if (result.intent === "search" && result.searchQuery) {
          setSearchQuery(result.searchQuery);
          saveToHistory(result.searchQuery);
        }
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
    } finally {
      setIsProcessingVoice(false);
    }
    setRecording(null);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const saved = await AsyncStorage.getItem("search_history");
    if (saved) setSearchHistory(JSON.parse(saved));
  };

  const saveToHistory = async (query: string) => {
    if (!query.trim()) return;
    const newHistory = [
      query,
      ...searchHistory.filter((q) => q !== query),
    ].slice(0, 5);
    setSearchHistory(newHistory);
    await AsyncStorage.setItem("search_history", JSON.stringify(newHistory));
  };

  const clearHistory = async () => {
    const previousHistory = [...searchHistory];

    useUndoStore.getState().queueAction({
      message: t("admin.clear_search_pending"),
      onCommit: async () => {
        // Commit: Actually delete from storage
        await AsyncStorage.removeItem("search_history");
      },
      onUndo: () => {
        // Undo: Restore to previous state
        setSearchHistory(previousHistory);
      },
    });

    // Optimistic Update
    setSearchHistory([]);
  };

  const resetFilters = () => {
    setSelectedYear(null);
    setSelectedLanguage(null);
    setSelectedCategory(null);
    setSelectedRating(null);
    setIsAvailableOnly(false);
  };

  const activeFilterCount =
    (selectedYear ? 1 : 0) +
    (selectedLanguage ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedRating ? 1 : 0) +
    (isAvailableOnly ? 1 : 0);

  const { isLocked, lockReason } = useAccountStatus();

  const filteredBooks = useMemo(() => {
    if (!allBooks) return [];

    return allBooks.filter((book: any) => {
      // Handle both nested volumeInfo (standard Google API) and flat (local DB)
      const gd = book.google_data as any;
      const googleInfo = gd?.volumeInfo || gd;

      const translatedCategory = book.category
        ? String(t("categories." + book.category))
        : "";

      const matchesSearch =
        !debouncedQuery ||
        (book.title || "")
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase()) ||
        (book.author || "")
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase()) ||
        (book.category || "")
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase()) ||
        (translatedCategory || "")
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase()) ||
        (book.description || "")
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase()) ||
        (book.appendix || "")
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase());

      // Year logic with fallback
      const bookYear =
        googleInfo?.publishedDate?.substring(0, 4) ||
        book.published_date?.substring(0, 4);
      const matchesYear =
        !selectedYear ||
        (selectedYear === "before_2020"
          ? bookYear && parseInt(bookYear) < 2020
          : bookYear === selectedYear);

      // Language logic - Improved to handle ISO codes and common labels
      const bookLang = (book.language || "").toLowerCase();
      const selectedLangCode = selectedLanguage?.toLowerCase(); // e.g. "en", "vi"

      const matchesLanguage =
        !selectedLanguage ||
        bookLang === selectedLangCode ||
        (selectedLangCode === "en" &&
          (bookLang === "english" || bookLang === "eng")) ||
        (selectedLangCode === "vi" &&
          (bookLang === "vietnamese" || bookLang === "vie")) ||
        (selectedLangCode &&
          bookLang &&
          String(t(`languages.${bookLang}`))
            .toLowerCase()
            .includes(selectedLangCode)) ||
        (selectedLanguage &&
          bookLang &&
          String(t(`languages.${bookLang}`)).toLowerCase() ===
            String(t(`languages.${selectedLanguage}`)).toLowerCase());

      // Category logic - Improved to handle bidirectional translation and partial matches
      const cat = (book.category || "").toLowerCase();
      const translatedCat = cat
        ? String(t("categories." + book.category)).toLowerCase()
        : "";
      const selectedCategoryKey = selectedCategory
        ? selectedCategory.toLowerCase()
        : "";

      // Get translations for the selected category in both languages to ensure match
      const selectedInEn = String(
        t(`categories.${selectedCategory}`, { lng: "en" }),
      ).toLowerCase();
      const selectedInVi = String(
        t(`categories.${selectedCategory}`, { lng: "vi" }),
      ).toLowerCase();

      const matchesCategory =
        !selectedCategory ||
        cat === selectedCategoryKey ||
        translatedCat === selectedCategoryKey ||
        cat === selectedInEn ||
        cat === selectedInVi ||
        translatedCat === selectedInEn ||
        translatedCat === selectedInVi ||
        cat.includes(selectedCategoryKey) ||
        selectedCategoryKey.includes(cat);

      // Rating logic with fallback
      const bookRating = googleInfo?.averageRating || book.average_rating || 0;
      const matchesRating = !selectedRating || bookRating >= selectedRating;

      // Availability logic
      // Availability logic - sum from all branches
      const totalAvailable =
        book.branch_inventory?.reduce(
          (sum: number, inv: any) => sum + (inv.available_copies || 0),
          0,
        ) || 0;
      const matchesAvailability = !isAvailableOnly || totalAvailable > 0;

      return (
        matchesSearch &&
        matchesYear &&
        matchesLanguage &&
        matchesCategory &&
        matchesRating &&
        matchesAvailability
      );
    });
  }, [
    allBooks,
    debouncedQuery,
    selectedYear,
    selectedLanguage,
    selectedCategory,
    selectedRating,
    isAvailableOnly,
    t,
  ]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: 20,
            paddingBottom: 10,
          },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(member)")
            }
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: 24 }]}>
            {t("common.search")}
          </Text>

          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => {
              setSearchQuery("");
              setSelectedYear(null);
              setSelectedLanguage(null);
              setSelectedRating(null);
              setSelectedCategory(null);
              setIsAvailableOnly(false);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.05)",
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel={t("search.reset_all")}
          >
            <Ionicons name="refresh" size={18} color="#8B8FA3" />
          </TouchableOpacity>
        </View>

        {isLocked && (
          <View style={styles.lockWarning}>
            <Ionicons name="lock-closed" size={16} color="#FF4444" />
            <Text style={styles.lockWarningText}>
              {lockReason || t("auth.locked_title")}
            </Text>
          </View>
        )}

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#8B8FA3" />
          <TextInput
            style={styles.input}
            placeholder={t("common.search_placeholder")}
            placeholderTextColor="#5A5F7A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => saveToHistory(searchQuery)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#8B8FA3" />
            </TouchableOpacity>
          )}
          <Animated.View style={micAnimatedStyle}>
            <TouchableOpacity
              onPress={startListening}
              style={styles.micBtn}
              accessibilityRole="button"
              accessibilityLabel={t("search.voice_search")}
            >
              <Ionicons
                name="mic"
                size={20}
                color={isListening ? "#FFFFFF" : "#3A75F2"}
              />
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              activeFilterCount > 0 && styles.filterBtnActive,
            ]}
            onPress={() => setIsFilterModalVisible(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? "#FFFFFF" : "#8B8FA3"}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchModeRow}>
          <TouchableOpacity
            style={[
              styles.modeToggle,
              !isSemanticSearch && styles.modeToggleActive,
            ]}
            onPress={() => setIsSemanticSearch(false)}
          >
            <Text
              style={[
                styles.modeToggleText,
                !isSemanticSearch && styles.modeToggleTextActive,
              ]}
            >
              {t("common.text_search")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeToggle,
              isSemanticSearch && styles.modeToggleActive,
            ]}
            onPress={() => setIsSemanticSearch(true)}
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={isSemanticSearch ? "#FFFFFF" : "#8B8FA3"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.modeToggleText,
                isSemanticSearch && styles.modeToggleTextActive,
              ]}
            >
              {t("common.semantic_search")}
            </Text>
          </TouchableOpacity>
        </View>

        {activeFilterCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activeFiltersBar}
          >
            {selectedYear && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedYear(null)}
              >
                <Text style={styles.activeFilterText}>
                  {t("common.year")}:{" "}
                  {selectedYear === "before_2020"
                    ? t("common.before_2020")
                    : selectedYear}
                </Text>
                <Ionicons name="close" size={14} color="#3A75F2" />
              </TouchableOpacity>
            )}
            {selectedLanguage && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedLanguage(null)}
              >
                <Text style={styles.activeFilterText}>
                  {t("languages." + selectedLanguage)}
                </Text>
                <Ionicons name="close" size={14} color="#3A75F2" />
              </TouchableOpacity>
            )}
            {selectedCategory && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={styles.activeFilterText}>
                  {t("categories." + selectedCategory)}
                </Text>
                <Ionicons name="close" size={14} color="#3A75F2" />
              </TouchableOpacity>
            )}
            {selectedRating && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedRating(null)}
              >
                <Text style={styles.activeFilterText}>
                  {selectedRating} {t("common.stars_or_more")}
                </Text>
                <Ionicons name="close" size={14} color="#3A75F2" />
              </TouchableOpacity>
            )}
            {isAvailableOnly && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setIsAvailableOnly(false)}
              >
                <Text style={styles.activeFilterText}>
                  {t("common.available_status")}
                </Text>
                <Ionicons name="close" size={14} color="#3A75F2" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.resetAllBtn} onPress={resetFilters}>
              <Text style={styles.resetAllText}>{t("common.reset")}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            {isSearching && (
              <View style={styles.searchingOverlay}>
                <ActivityIndicator size="small" color="#3A75F2" />
                <Text style={styles.searchingText}>
                  {t("common.ai_searching")}
                </Text>
              </View>
            )}
            {!searchQuery && searchHistory.length > 0 && (
              <View
                style={styles.historySection}
                accessibilityLabel={t("common.search_history")}
              >
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>
                    {t("common.recent_searches")}
                  </Text>
                  <TouchableOpacity
                    onPress={clearHistory}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.clear_search_history")}
                  >
                    <Text style={styles.clearText}>
                      {t("common.clear_all")}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.historyChips}>
                  {searchHistory.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.chip}
                      onPress={() => setSearchQuery(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("common.search")}: ${item}`}
                    >
                      <Text style={styles.chipText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {isLoading && (
              <ActivityIndicator
                size="large"
                color="#4F8EF7"
                style={{ marginTop: 40 }}
              />
            )}
          </>
        }
        data={
          isSemanticSearch && searchQuery.trim()
            ? semanticResults
            : filteredBooks
        }
        keyExtractor={(book) => book.isbn}
        renderItem={({ item: book, index }) => (
          <BookItem
            item={book}
            index={index}
            badge={
              isSemanticSearch ? (
                <View style={styles.similarityBadge}>
                  <Ionicons name="sparkles" size={10} color="#FFFFFF" />
                  <Text style={styles.similarityText}>
                    {Math.round(((book as any).similarity || 0.5) * 100)}%{" "}
                    {t("common.match")}
                  </Text>
                </View>
              ) : undefined
            }
            onPress={(item) => {
              router.push(`/(member)/book/${book.isbn}` as any);
            }}
            onRatingPress={() => {
              router.push(`/(member)/book/${book.isbn}` as any);
            }}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <Ionicons name="search-outline" size={64} color="#1E2540" />
              <Text style={styles.emptyText}>{t("messages.no_results")}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: horizontalPadding },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { maxHeight: modalMaxHeight, padding: horizontalPadding },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("common.search_filter")}</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
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
                  onPress={resetFilters}
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
                    {t("common.clear_all")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsFilterModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.filterLabel}>
                {t("common.published_year")}
              </Text>
              <View style={styles.filterOptions}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[
                      styles.filterOption,
                      selectedYear === y && styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setSelectedYear(selectedYear === y ? null : y)
                    }
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedYear === y && styles.filterOptionTextActive,
                      ]}
                    >
                      {y === "before_2020" ? t("common.before_2020") : y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>{t("common.language")}</Text>
              <View style={styles.filterOptions}>
                {languagesList.map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[
                      styles.filterOption,
                      selectedLanguage === l && styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setSelectedLanguage(selectedLanguage === l ? null : l)
                    }
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedLanguage === l && styles.filterOptionTextActive,
                      ]}
                    >
                      {t("languages." + l)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>{t("common.genre")}</Text>
              <View style={styles.filterOptions}>
                {availableCategories.map((c: string) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.filterOption,
                      selectedCategory === c && styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setSelectedCategory(selectedCategory === c ? null : c)
                    }
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedCategory === c && styles.filterOptionTextActive,
                      ]}
                    >
                      {t("categories." + c)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>{t("common.min_rating")}</Text>
              <View style={styles.filterOptions}>
                {[5, 4, 3, 2, 1].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.filterOption,
                      selectedRating === r && styles.filterOptionActive,
                    ]}
                    onPress={() =>
                      setSelectedRating(selectedRating === r ? null : r)
                    }
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedRating === r && styles.filterOptionTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                      <Ionicons
                        name="star"
                        size={12}
                        color={selectedRating === r ? "#FFFFFF" : "#F59E0B"}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>{t("common.status")}</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    isAvailableOnly && styles.filterOptionActive,
                  ]}
                  onPress={() => setIsAvailableOnly(!isAvailableOnly)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      isAvailableOnly && styles.filterOptionTextActive,
                    ]}
                  >
                    {t("common.available_only")}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => setIsFilterModalVisible(false)}
            >
              <Text style={styles.applyBtnText}>{t("common.apply")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Voice Search Modal */}
      <Modal visible={isListening} transparent={true} animationType="fade">
        <View style={styles.voiceOverlay}>
          <View style={[styles.voiceCard, { width: voiceCardWidth }]}>
            <View style={styles.voiceWaveContainer}>
              {[0, 1, 2, 3, 4].map((i) => (
                <AnimatedVoiceWave key={i} index={i} />
              ))}
            </View>
            <Text style={styles.voiceStatus}>{t("common.listening")}</Text>
            <TouchableOpacity
              style={styles.cancelVoiceBtn}
              onPress={() => stopListening(false)}
            >
              <Text style={styles.cancelVoiceText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Assistant Modal */}
      <Modal
        visible={showAiModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAiModal(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setShowAiModal(false)}
          />
          <Animated.View
            entering={FadeInUp}
            style={[styles.aiModalContent, { height: aiModalHeight }]}
          >
            <LinearGradient
              colors={["#1E2540", "#0B0F1A"]}
              style={styles.aiModalGradient}
            >
              <View style={styles.aiModalHeader}>
                <View style={styles.aiIconBadge}>
                  <Ionicons name="sparkles" size={24} color="#FFD700" />
                </View>
                <Text style={styles.aiModalTitle}>
                  {t("common.ai_librarian")}
                </Text>
                <TouchableOpacity onPress={() => setShowAiModal(false)}>
                  <Ionicons name="close" size={24} color="#8B8FA3" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.aiModalBody}>
                <Text style={styles.aiResponseText}>{aiResponse?.text}</Text>

                {aiResponse?.books?.length > 0 && (
                  <View style={styles.aiBooksSection}>
                    <Text style={styles.aiSubTitle}>
                      {t("common.books_suggested")}
                    </Text>
                    {aiResponse.books.map((book: any) => (
                      <TouchableOpacity
                        key={book.id}
                        style={styles.aiBookItem}
                        onPress={() => {
                          setShowAiModal(false);
                          router.push(`/book/${book.isbn}`);
                        }}
                      >
                        <Image
                          source={{
                            uri: resolveBookCoverUrl(book, FALLBACK_BOOK_COVER),
                          }}
                          style={styles.aiBookCover}
                          resizeMode="contain"
                        />
                        <View style={styles.aiBookInfo}>
                          <Text style={styles.aiBookTitle} numberOfLines={1}>
                            {book.title}
                          </Text>
                          <Text style={styles.aiBookAuthor}>{book.author}</Text>
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

              <TouchableOpacity
                style={styles.aiCloseBtn}
                onPress={() => setShowAiModal(false)}
              >
                <Text style={styles.aiCloseBtnText}>{t("common.got_it")}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  header: { paddingTop: 60, paddingBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  backButton: {
    marginRight: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#151929",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151929",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  searchModeRow: { flexDirection: "row", marginTop: 16, gap: 8 },
  modeToggle: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#151929",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  modeToggleActive: { backgroundColor: "#3A75F2", borderColor: "#3A75F2" },
  modeToggleText: { color: "#8B8FA3", fontSize: 13, fontWeight: "600" },
  modeToggleTextActive: { color: "#FFFFFF" },
  searchingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginVertical: 10,
    backgroundColor: "rgba(58, 117, 242, 0.05)",
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(58, 117, 242, 0.1)",
  },
  searchingText: {
    color: "#3A75F2",
    fontSize: 14,
    fontWeight: "600",
    fontStyle: "italic",
  },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: "#FFFFFF" },
  list: { paddingBottom: 100 },
  bookCard: {
    backgroundColor: "#151929",
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  coverContainer: {
    width: 60,
    height: 85,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E2540",
  },
  cover: { width: "100%", height: "100%" },
  info: { flex: 1, marginLeft: 16 },
  bookTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  author: { color: "#8B8FA3", fontSize: 13, marginTop: 2 },
  badge: {
    backgroundColor: "rgba(79, 142, 247, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  badgeText: { color: "#4F8EF7", fontSize: 10, fontWeight: "800" },
  similarityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A75F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 8,
    gap: 4,
  },
  similarityText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  borrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#4F8EF7",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: { backgroundColor: "#1E2540" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyText: {
    color: "#3D4260",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  lockWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.2)",
  },
  lockWarningText: {
    color: "#FF4444",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  historySection: { marginBottom: 32 },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    color: "#8B8FA3",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearText: { color: "#3B82F6", fontSize: 13 },
  historyChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#151929",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  chipText: { color: "#FFFFFF", fontSize: 14 },
  filterBtn: {
    padding: 8,
    marginLeft: 8,
  },
  filterBtnActive: {
    backgroundColor: "#3A75F2",
    borderRadius: 8,
  },
  filterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#151929",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
  },
  activeFiltersBar: {
    marginTop: 16,
    flexDirection: "row",
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(58, 117, 242, 0.2)",
  },
  activeFilterText: {
    color: "#3A75F2",
    fontSize: 12,
    fontWeight: "600",
  },
  resetAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: "center",
  },
  resetAllText: {
    color: "#5A5F7A",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
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
    borderTopWidth: 1,
    borderColor: "#1E2540",
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
  filterLabel: {
    color: "#8B8FA3",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 16,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterOption: {
    backgroundColor: "#151929",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  filterOptionActive: {
    backgroundColor: "#3A75F2",
    borderColor: "#3A75F2",
  },
  filterOptionText: {
    color: "#8B8FA3",
    fontSize: 14,
    fontWeight: "500",
  },
  filterOptionTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  applyBtn: {
    backgroundColor: "#3A75F2",
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  micBtn: {
    padding: 8,
    marginRight: 4,
  },
  voiceOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 15, 26, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceCard: {
    backgroundColor: "#151929",
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  voiceWaveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 80,
    marginBottom: 20,
  },
  voiceWave: {
    width: 6,
    height: 40,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  voiceStatus: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  cancelVoiceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelVoiceText: {
    color: "#8B8FA3",
    fontSize: 14,
    fontWeight: "600",
  },
  // AI Modal Styles
  aiModalContent: {
    backgroundColor: "#0B0F1A",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  aiModalGradient: {
    flex: 1,
    padding: 24,
  },
  aiModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  aiIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  aiModalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    marginLeft: 12,
  },
  aiModalBody: {
    flex: 1,
  },
  aiResponseText: {
    color: "#E2E8F0",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  aiBooksSection: {
    marginTop: 16,
  },
  aiSubTitle: {
    color: "#3A75F2",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  aiBookItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  aiBookCover: {
    width: 50,
    height: 70,
    borderRadius: 8,
  },
  aiBookInfo: {
    flex: 1,
    marginLeft: 12,
  },
  aiBookTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  aiBookAuthor: {
    color: "#8B8FA3",
    fontSize: 12,
    marginTop: 2,
  },
  aiCloseBtn: {
    backgroundColor: "#3A75F2",
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  aiCloseBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
