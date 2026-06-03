import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ai } from "../../../core/ai";
import { Book } from "../../../hooks/useLibrary";
import { useRouter } from "expo-router";
import {
  FALLBACK_BOOK_COVER,
  resolveBookCoverUrl,
} from "../../../core/mediaAssets";

interface SimilarBooksProps {
  currentBook: Book;
}

export const SimilarBooks: React.FC<SimilarBooksProps> = ({ currentBook }) => {
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSimilarBooks = async () => {
      setIsLoading(true);
      try {
        // Use semantic search based on current book's context
        const query = `${currentBook.title} ${currentBook.category} ${currentBook.description || ""}`;
        const results = await ai.semanticSearch(query, 0.4, 6);

        // Filter out the current book itself
        const filtered = results.filter(
          (b: Book) => b.isbn !== currentBook.isbn,
        );
        setSimilarBooks(filtered);
      } catch (error) {
        console.error("[SimilarBooks] Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSimilarBooks();
  }, [currentBook.isbn]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#3A75F2" />
        <Text style={styles.loadingText}>Đang tìm sách tương tự...</Text>
      </View>
    );
  }

  if (similarBooks.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color="#3A75F2" />
        <Text style={styles.title}>Có thể bạn cũng thích (AI)</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {similarBooks.map((book) => (
          <TouchableOpacity
            key={book.isbn}
            style={styles.card}
            onPress={() => router.push(`/(member)/book/${book.isbn}` as any)}
          >
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: resolveBookCoverUrl(book, FALLBACK_BOOK_COVER) }}
                style={styles.cover}
                resizeMode="contain"
              />
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <Text style={styles.ratingText}>
                  {book.average_rating?.toFixed(1) || "0.0"}
                </Text>
              </View>
            </View>
            <Text style={styles.bookTitle} numberOfLines={2}>
              {book.title}
            </Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>
              {book.author}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 32, marginBottom: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 16 },
  card: { width: 120, marginLeft: 8, marginRight: 8 },
  coverContainer: {
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#151929",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cover: { width: "100%", height: "100%" },
  ratingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(15, 19, 41, 0.8)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  ratingText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  bookTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    lineHeight: 18,
  },
  bookAuthor: { color: "#8B8FA3", fontSize: 11, marginTop: 2 },
  loading: { padding: 40, alignItems: "center", gap: 12 },
  loadingText: { color: "#5A5F7A", fontSize: 13, fontStyle: "italic" },
});
