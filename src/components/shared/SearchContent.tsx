import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
  Dimensions,
} from "react-native";
import { Audio } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useLibrary, Book } from "../../hooks/useLibrary";
import { BookItem } from "../../features/books/components/BookItem";
import { useAccountStatus } from "../../hooks/useAccountStatus";
import { ai } from "../../core/ai";
import { useUndoStore } from "../../store/useUndoStore";

const { width } = Dimensions.get("window");

const AnimatedVoiceWave = ({ index }: { index: number }) => {
  const scaleY = useSharedValue(1);

  useEffect(() => {
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

interface SearchContentProps {
  onBookPress: (book: Book) => void;
  title?: string;
  showBack?: boolean;
}

export const SearchContent = ({ onBookPress, title, showBack = true }: SearchContentProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { books } = useLibrary();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const { data: allBooks, isLoading } = books.list();

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
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
    const raw = Array.from(new Set([
      ...defaultCategories,
      ...((allBooks || [])
        .map((b: any) => b.category)
        .filter(Boolean) as string[]),
    ]));

    const uniqueMap = new Map<string, string>();
    raw.forEach(cat => {
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
        const mockPhrases = [
          t("search.voice_phrase_6"),
          t("search.voice_phrase_7"),
          t("search.voice_phrase_5"),
          t("search.voice_phrase_4"),
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
        await AsyncStorage.removeItem("search_history");
      },
      onUndo: () => {
        setSearchHistory(previousHistory);
      },
    });

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

  const filteredBooks = allBooks?.filter((book: any) => {
    const googleInfo = (book.google_data as any)?.volumeInfo;
    const translatedCategory = book.category
      ? String(t("categories." + book.category))
      : "";

    const matchesSearch =
      !debouncedQuery ||
      book.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      book.author?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      book.category?.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      translatedCategory.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      book.description?.toLowerCase().includes(debouncedQuery.toLowerCase());

    const bookYear =
      googleInfo?.publishedDate?.substring(0, 4) ||
      book.published_date?.substring(0, 4);
    const matchesYear =
      !selectedYear ||
      (selectedYear === "before_2020"
        ? bookYear && parseInt(bookYear) < 2020
        : bookYear === selectedYear);

    const bookLang = (book.language || "").toLowerCase();
    const selectedLangCode = selectedLanguage?.toLowerCase();
    
    const matchesLanguage =
      !selectedLanguage ||
      bookLang === selectedLangCode ||
      (selectedLangCode === "en" && (bookLang === "english" || bookLang === "eng")) ||
      (selectedLangCode === "vi" && (bookLang === "vietnamese" || bookLang === "vie"));

    const cat = (book.category || "").toLowerCase();
    const matchesCategory =
      !selectedCategory ||
      cat === selectedCategory.toLowerCase() ||
      String(t("categories." + book.category)).toLowerCase() === selectedCategory.toLowerCase();

    const bookRating = googleInfo?.averageRating || book.average_rating || 0;
    const matchesRating = !selectedRating || bookRating >= selectedRating;

    const matchesAvailability = !isAvailableOnly || book.available_copies > 0;

    return (
      matchesSearch &&
      matchesYear &&
      matchesLanguage &&
      matchesCategory &&
      matchesRating &&
      matchesAvailability
    );
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: 20, paddingBottom: 10 }]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { fontSize: 24 }]}>
            {title || t("common.search")}
          </Text>

          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={resetFilters}
            style={styles.headerActionBtn}
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
              <View style={styles.historySection}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>
                    {t("common.recent_searches")}
                  </Text>
                  <TouchableOpacity onPress={clearHistory}>
                    <Text style={styles.clearText}>{t("common.clear_all")}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.historyChips}>
                  {searchHistory.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.chip}
                      onPress={() => setSearchQuery(item)}
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
        data={isSemanticSearch && searchQuery.trim() ? semanticResults : filteredBooks}
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
            onPress={() => onBookPress(book)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={64} color="#1E2540" />
              <Text style={styles.emptyText}>{t("messages.no_results")}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("common.search_filter")}</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>{t("common.published_year")}</Text>
              <View style={styles.filterOptions}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[
                      styles.filterOption,
                      selectedYear === y && styles.filterOptionActive,
                    ]}
                    onPress={() => setSelectedYear(selectedYear === y ? null : y)}
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
                    onPress={() => setSelectedLanguage(selectedLanguage === l ? null : l)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedLanguage === l && styles.filterOptionTextActive,
                      ]}
                    >
                      {t(`languages.${l}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>{t("common.category")}</Text>
              <View style={styles.filterOptions}>
                {availableCategories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.filterOption,
                      selectedCategory === c && styles.filterOptionActive,
                    ]}
                    onPress={() => setSelectedCategory(selectedCategory === c ? null : c)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedCategory === c && styles.filterOptionTextActive,
                      ]}
                    >
                      {t(`categories.${c}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  header: {
    paddingHorizontal: 20,
    backgroundColor: "#0B0F1A",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
  },
  lockWarningText: {
    color: "#FF4444",
    fontSize: 12,
    marginLeft: 8,
    fontWeight: "600",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E2540",
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 54,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 10,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(58, 117, 242, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: "#3A75F2",
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0B0F1A",
  },
  filterBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  searchModeRow: {
    flexDirection: "row",
    marginTop: 15,
    marginBottom: 5,
    gap: 10,
  },
  modeToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modeToggleActive: {
    backgroundColor: "rgba(58, 117, 242, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(58, 117, 242, 0.4)",
  },
  modeToggleText: {
    color: "#8B8FA3",
    fontSize: 13,
    fontWeight: "600",
  },
  modeToggleTextActive: {
    color: "#FFFFFF",
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  historySection: {
    marginBottom: 20,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    color: "#8B8FA3",
    fontSize: 14,
    fontWeight: "600",
  },
  clearText: {
    color: "#3A75F2",
    fontSize: 13,
  },
  historyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#1E2540",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    color: "#FFFFFF",
    fontSize: 13,
  },
  searchingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(58, 117, 242, 0.05)",
    borderRadius: 12,
    marginBottom: 15,
  },
  searchingText: {
    color: "#3A75F2",
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  similarityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A75F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  similarityText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 4,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  emptyText: {
    color: "#8B8FA3",
    fontSize: 16,
    marginTop: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#161B2E",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  modalBody: {
    marginBottom: 20,
  },
  filterLabel: {
    color: "#8B8FA3",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 15,
    textTransform: "uppercase",
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterOptionActive: {
    backgroundColor: "rgba(58, 117, 242, 0.15)",
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
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  voiceWave: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginHorizontal: 1,
  },
});
