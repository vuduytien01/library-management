import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { supabase } from "../../api/supabase";
import { booksService } from "../../features/books/books.service";
import { useAuthStore } from "../../store/useAuthStore";
import { Book } from "../../features/books/books.types";

export const localizeItem = (item: any, t: any, language: string) => {
  if (!item) return item;

  const isEn = language?.startsWith("en");
  let duration = item.duration;
  let duration_seconds = item.duration_seconds;

  if (
    (item.source_platform || item.chapters) &&
    (!duration || duration === "0 phút")
  ) {
    const calculated = booksService.calculateAudiobookDuration(item);
    if (calculated > 0) {
      duration_seconds = calculated;
      duration = booksService.formatDuration(calculated);
    }
  }

  // Core metadata localization
  const title = isEn
    ? item.title_en || item.title
    : item.title_vi || item.title;
  const description = isEn
    ? item.description_en || item.description
    : item.description_vi || item.description;
  const author = isEn
    ? item.author_en || item.author
    : item.author_vi || item.author;
  const narrator = isEn
    ? item.narrator_en || item.narrator
    : item.narrator_vi || item.narrator;

  // Category localization
  let category = item.category;
  if (category) {
    category = t(`categories.${category}`, { defaultValue: category });
  }

  let categories = item.categories;
  if (Array.isArray(categories)) {
    categories = categories.map((c: string) =>
      t(`categories.${c}`, { defaultValue: c }),
    );
  }

  // Recursively localize nested book objects (often found in audiobook joined queries)
  let book = item.book;
  if (book) {
    book = localizeItem(book, t, language);
  }

  return {
    ...item,
    duration,
    duration_seconds,
    title,
    description,
    author,
    narrator,
    category,
    categories,
    book,
    // Keep raw fields for admin usage if needed
    title_en: item.title_en || item.title,
    title_vi: item.title_vi || item.title,
    description_en: item.description_en || item.description,
    description_vi: item.description_vi || item.description,
  };
};

export function useContent() {
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user.id;
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "vi";

  const localize = useCallback(
    (item: any) => localizeItem(item, t, lang),
    [t, lang],
  );

  const booksQuery = useQuery<Book[]>({
    queryKey: ["books", lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("title");
      if (error) throw error;
      return (data || []).map(localize);
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const audiobooksQuery = useQuery({
    queryKey: ["audiobooks", 100, lang],
    queryFn: async () => {
      const list = await booksService.browseAudiobooks(100);
      return list.map(localize);
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const addAudiobook = useMutation({
    mutationFn: async (audiobook: any) => {
      const { skip_metadata_enrichment, ...audiobookPayload } = audiobook;
      let enrichedAudiobook = skip_metadata_enrichment
        ? audiobookPayload
        : await booksService.enrichAudiobookPayload(audiobookPayload);

      const { data, error } = await supabase
        .from("audiobook_metadata")
        .insert([enrichedAudiobook])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      queryClient.setQueriesData<any[]>(
        { queryKey: ["audiobooks"] },
        (current) =>
          Array.isArray(current)
            ? [localize(created), ...current.filter((item) => item.id !== created.id)]
            : current,
      );
      queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
    },
  });

  const updateAudiobook = useMutation({
    mutationFn: async ({ id, ...audiobook }: any) => {
      const { skip_metadata_enrichment, ...audiobookPayload } = audiobook;
      const enrichedAudiobook = skip_metadata_enrichment
        ? audiobookPayload
        : await booksService.enrichAudiobookPayload(audiobookPayload);
      const { data, error } = await supabase
        .from("audiobook_metadata")
        .update(enrichedAudiobook)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (updated, v) => {
      queryClient.setQueriesData<any[]>(
        { queryKey: ["audiobooks"] },
        (current) =>
          Array.isArray(current)
            ? current.map((item) =>
                item.id === updated.id ? localize(updated) : item,
              )
            : current,
      );
      queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
      queryClient.invalidateQueries({ queryKey: ["audiobook", v.id] });
    },
  });

  const deleteAudiobook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("audiobook_metadata")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.setQueriesData<any[]>(
        { queryKey: ["audiobooks"] },
        (current) =>
          Array.isArray(current)
            ? current.filter((item) => item.id !== id)
            : current,
      );
      queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
    },
  });

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations", userId, lang],
    enabled: !!userId,
    queryFn: async () => {
      const list = await booksService.getSemanticRecommendations(userId!, 5);
      return list.map(localize);
    },
  });

  const profile = useAuthStore((state) => state.profile);
  const interestRecommendationsQuery = useQuery({
    queryKey: ["interest_recommendations", profile?.favoriteGenres, lang],
    enabled: !!profile?.id,
    queryFn: async () => {
      const genres = profile?.favoriteGenres || [];
      if (genres.length === 0) return [];

      // Expand Vietnamese genre names to English ones found in DB
      const genreMap: Record<string, string[]> = {
        "Văn học": ["Fiction", "Literary Collections", "Literary Criticism"],
        "Khoa học": ["Science", "Mathematics", "Nature"],
        "Lịch sử": ["History"],
        "Công nghệ": [
          "Computers",
          "Technology",
          "Technology & Engineering",
          "COMPUTERS",
          "Application software",
        ],
        "Nghệ thuật": ["Art", "Music", "Performing Arts", "Crafts & Hobbies"],
        "Kinh tế": ["Business & Economics"],
        "Kỹ năng": [
          "Self-Help",
          "Psychology",
          "Health & Fitness",
          "Family & Relationships",
        ],
        "Truyện tranh": ["Comics & Graphic Novels"],
        "Tiểu thuyết": ["Fiction"],
        "Tâm lý": [
          "Psychology",
          "Family & Relationships",
          "Body, Mind & Spirit",
        ],
        "Triết học": ["Philosophy"],
        "Học ngoại ngữ": [
          "Foreign Language Study",
          "Language Arts & Disciplines",
        ],
        "Chính trị - Văn hóa": ["Chính trị - Văn hóa", "Social Science", "Law"],
      };

      const expandedGenres = genres.flatMap((g) => genreMap[g] || [g]);
      const list = await booksService.getRecommendationsByGenres(
        expandedGenres,
        10,
      );
      return list.map(localize);
    },
  });

  const addReview = useMutation({
    mutationFn: async (review: any) => {
      const { data, error } = await supabase
        .from("reviews")
        .upsert([{ ...review, user_id: userId }]);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) =>
      queryClient.invalidateQueries({ queryKey: ["reviews", v.book_isbn] }),
  });

  const syncBook = useMutation({
    mutationFn: (isbn: string) => booksService.syncBookMetadata(isbn),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });

  const semanticSearchMutation = useMutation({
    mutationFn: async ({ query }: { query: string }) => {
      const results = await booksService.semanticSearch(query);
      return results.map(localize);
    },
  });

  const wrap = (q: any) => () => q;

  return useMemo(() => {
    return {
      books: {
        list: wrap(booksQuery),
        sync: syncBook,
        semanticSearchMutation,
      },
      audiobooks: {
        list: wrap(audiobooksQuery),
        add: addAudiobook,
        update: updateAudiobook,
        delete: deleteAudiobook,
      },
      recommendations: {
        get: wrap(recommendationsQuery),
        interests: wrap(interestRecommendationsQuery),
      },
      reviews: { add: addReview },
      r2: {
        list: (prefix?: string) => booksService.listR2Objects(prefix),
        getMetadata: (path: string) => booksService.getR2Metadata(path),
      },
    };
  }, [
    booksQuery.data,
    booksQuery.status,
    audiobooksQuery.data,
    audiobooksQuery.status,
    recommendationsQuery.data,
    recommendationsQuery.status,
    interestRecommendationsQuery.data,
    interestRecommendationsQuery.status,
    syncBook,
    semanticSearchMutation,
    addAudiobook,
    updateAudiobook,
    deleteAudiobook,
    addReview,
  ]);
}

export function useBook(isbn: string) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "vi";
  return useQuery({
    queryKey: ["book", isbn, lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*, branch_inventory(*)")
        .eq("isbn", isbn)
        .single();
      if (error) throw error;
      return localizeItem(data, t, lang);
    },
    enabled: !!isbn,
  });
}

export function useAudiobook(id: string) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "vi";

  return useQuery({
    queryKey: ["audiobook", id, lang],
    queryFn: async () => {
      if (!id) return null;

      // Add a 10s timeout to the query function to prevent infinite loading
      const queryPromise = (async () => {
        const { data, error, status } = await supabase
          .from("audiobook_metadata")
          .select(
            "*, book:books(title, author, description, cover_url, category, title_en, title_vi, description_en, description_vi)",
          )
          .eq("id", id)
          .maybeSingle();

        if (error) {
          // Handle Auth/RLS/Permission errors explicitly
          if (status === 401 || status === 403 || error.code === "42501") {
            throw new Error("PERMISSION_DENIED");
          }
          throw error;
        }

        if (!data) return null;

        // Use fast=true to prevent AI enrichment from hanging the main query
        const enriched = await booksService.enrichWithBookMetadata(
          [data],
          true,
        );
        return localizeItem(enriched[0], t, lang);
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("QUERY_TIMEOUT")), 10000),
      );

      return await Promise.race([queryPromise, timeoutPromise]);
    },
    enabled: !!id,
    retry: (failureCount, error: any) =>
      !["PERMISSION_DENIED", "QUERY_TIMEOUT"].includes(error?.message) &&
      failureCount < 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 mins
  });
}

export function useBookInventory(isbn: string) {
  return useQuery({
    queryKey: ["branch_inventory", isbn],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_inventory")
        .select("*, branches(*)")
        .eq("book_isbn", isbn);
      if (error) throw error;
      return data || [];
    },
    enabled: !!isbn,
  });
}

export function useSimilarBooks(isbn: string, limit = 5) {
  return useQuery({
    queryKey: ["similar_books", isbn],
    queryFn: async () => {
      const list = await booksService.getSimilarBooks(isbn);
      return list.slice(0, limit);
    },
    enabled: !!isbn,
  });
}

export function useBookReviews(isbn: string) {
  return useQuery({
    queryKey: ["reviews", isbn],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, profiles(fullName:full_name, avatarUrl:avatar_url)")
        .eq("book_isbn", isbn)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!isbn,
  });
}
