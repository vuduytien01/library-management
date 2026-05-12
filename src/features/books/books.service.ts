import axios from "axios";
import { supabase } from "../../api/supabase";
import { ai } from "../../core/ai";
import {
  AudiobookRecord,
  Book,
  BookMetadata,
  EnrichedAudiobook,
} from "./books.types";

export const booksService = {
  /**
   * Normalizes ISBN by removing dashes, spaces, and 'ISBN:' prefix.
   */
  normalizeIsbn(isbn: string): string {
    return isbn
      .replace(/^ISBN:/i, "")
      .replace(/[-\s]/g, "")
      .trim();
  },

  /** Normalize a Vietnamese title for fuzzy matching */
  normalizeTitle(title: string): string {
    if (!title) return "";
    return title
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ỹ0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  /** 
   * Upgrades low-resolution Google Books thumbnails to higher resolution.
   * Also ensures HTTPS for all URLs.
   */
  upgradeImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    let upgraded = url.replace("http://", "https://");
    
    // Normalize Google Books URLs
    if (upgraded.includes("books.google.com/books/content") || upgraded.includes("google.com/books/content")) {
      // Force zoom=0 for maximum resolution
      if (upgraded.includes("zoom=")) {
        upgraded = upgraded.replace(/zoom=[1-9]/, "zoom=0");
      } else if (!upgraded.includes("zoom=0")) {
        upgraded += (upgraded.includes("?") ? "&" : "?") + "zoom=0";
      }
      
      // Remove restricting params
      upgraded = upgraded
        .replace(/&edge=curl/, "")
        .replace(/&printsec=frontcover/, "")
        .replace(/&imgtk=[A-Za-z0-9_-]+/, "");
      
      // Ensure we request a large width if fife is not used
      if (!upgraded.includes("fife") && !upgraded.includes("&w=")) {
        upgraded += "&w=1200";
      }
    } 
    // Normalize OpenLibrary URLs
    else if (upgraded.includes("covers.openlibrary.org")) {
      upgraded = upgraded.replace("-S.jpg", "-L.jpg").replace("-M.jpg", "-L.jpg");
    }
    
    return upgraded;
  },

  // --- Physical Books Metadata ---

  async fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
    const cleanIsbn = this.normalizeIsbn(isbn);

    let googleItem = null;
    let openLibData = null;

    try {
      const googleRes = await axios.get(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`,
        { timeout: 5000 },
      );
      googleItem = googleRes.data.items?.[0]?.volumeInfo || null;
    } catch (error: any) {
      console.warn(`Google Books API failed for ${cleanIsbn}:`, error.message);
    }

    try {
      const openLibRes = await axios.get(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
        { timeout: 5000 },
      );
      const openLibKey = `ISBN:${cleanIsbn}`;
      openLibData = openLibRes.data[openLibKey] || null;
    } catch (error: any) {
      console.warn(`Open Library API failed for ${cleanIsbn}:`, error.message);
    }

    if (!googleItem && !openLibData) return null;

    const translations = await ai.translateMetadata(
      googleItem?.title || openLibData?.title || "Unknown Title",
      googleItem?.description || openLibData?.notes || openLibData?.description || "",
      googleItem?.authors?.join(", ") || openLibData?.authors?.map((a: any) => a.name).join(", ") || "Unknown Author"
    );

    return {
      title: googleItem?.title || openLibData?.title || "Unknown Title",
      author:
        googleItem?.authors?.join(", ") ||
        openLibData?.authors?.map((a: any) => a.name).join(", ") ||
        "Unknown Author",
      description:
        googleItem?.description ||
        openLibData?.notes ||
        openLibData?.description ||
        "",
      publisher: googleItem?.publisher || openLibData?.publishers?.[0]?.name,
      publishedDate: googleItem?.publishedDate || openLibData?.publish_date,
      pageCount: googleItem?.pageCount || openLibData?.number_of_pages,
      categories:
        googleItem?.categories ||
        openLibData?.subjects?.map((s: any) => s.name) ||
        [],
      thumbnail: this.upgradeImageUrl(
        openLibData?.cover?.large ||
        openLibData?.cover?.medium ||
        googleItem?.imageLinks?.thumbnail ||
        googleItem?.imageLinks?.smallThumbnail ||
        `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`
      ),
      isbn: cleanIsbn,
      language: googleItem?.language || "vi",
      averageRating: googleItem?.averageRating,
      ratingsCount: googleItem?.ratingsCount,
      edition:
        googleItem?.contentVersion ||
        openLibData?.identifiers?.openlibrary?.[0],
      title_en: translations.title_en,
      title_vi: translations.title_vi,
      description_en: translations.description_en,
      description_vi: translations.description_vi,
      author_en: translations.author_en,
      author_vi: translations.author_vi,
      syncSource: {
        google: !!googleItem,
        openLib: !!openLibData,
      },
    };
  },

  /**
   * Fetches metadata by title and author when ISBN is not available.
   * Calls the search-book-metadata Supabase Edge Function to securely use the API key.
   */
  cleanTitle(title: string): string {
    return title
      .replace(/\(Audio.*?\)/gi, "")
      .replace(/\(Tiếng.*?\)/gi, "")
      .replace(/\(Full.*?\)/gi, "")
      .replace(/\[.*?\]/g, "")
      .replace(/-.*?$/, "") 
      .trim();
  },

  async fetchMetadataBySearch(
    title: string,
    author: string,
    titleEn?: string,
  ): Promise<Partial<BookMetadata> | null> {
    const cleanT = this.cleanTitle(title);
    const cleanTitle = titleEn || this.normalizeTitle(cleanT);
    const cleanAuthor = author ? this.normalizeTitle(author) : "";

    let openLibCover = null;

    // 1. Try Open Library Search for Cover (Use English title if available)
    try {
      const olSearchRes = await axios.get(
        `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}&limit=1`,
        { timeout: 5000 },
      );
      const doc = olSearchRes.data.docs?.[0];
      if (doc?.cover_i) {
        openLibCover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      } else if (doc?.isbn?.[0]) {
        openLibCover = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
      }
      
      // If we used English title and found nothing, try Vietnamese title as fallback
      if (!openLibCover && titleEn && titleEn !== title) {
        const olSearchResVi = await axios.get(
          `https://openlibrary.org/search.json?title=${encodeURIComponent(this.normalizeTitle(title))}&limit=1`,
          { timeout: 5000 },
        );
        const docVi = olSearchResVi.data.docs?.[0];
        if (docVi?.cover_i) {
          openLibCover = `https://covers.openlibrary.org/b/id/${docVi.cover_i}-L.jpg`;
        }
      }
    } catch (e) {
      console.warn("OpenLib search failed:", e);
    }

    // 2. Try Edge Function for Google Books metadata (uses Supabase secret GOOGLE_BOOKS_API_KEY)
    let googleMetadata: any = null;
    try {
      const queryTitle = titleEn || cleanT;
      const { data, error } = await supabase.functions.invoke('search-book-metadata', {
        body: { title: queryTitle, author: cleanAuthor }
      });

      if (!error && data?.success) {
        googleMetadata = data.data;
      } else {
        // Fallback to client-side Google Books API if edge function fails or is not deployed
        const query = titleEn ? `intitle:${titleEn} OR intitle:${cleanT}` : `intitle:${cleanT}`;
        const gRes = await axios.get(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}+inauthor:${encodeURIComponent(cleanAuthor)}&maxResults=1`,
          { timeout: 5000 },
        );
        const item = gRes.data.items?.[0]?.volumeInfo;
        if (item) {
          googleMetadata = {
            title: item.title,
            author: item.authors?.join(", "),
            description: item.description,
            thumbnail: item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail,
            categories: item.categories || []
          };
        }
      }
    } catch (e) {
      console.warn("Metadata search failed, trying direct fallback:", e);
      try {
        const query = titleEn ? `intitle:${titleEn} OR intitle:${cleanT}` : `intitle:${cleanT}`;
        const gRes = await axios.get(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}+inauthor:${encodeURIComponent(cleanAuthor)}&maxResults=1`,
          { timeout: 5000 },
        );
        const item = gRes.data.items?.[0]?.volumeInfo;
        if (item) {
          googleMetadata = {
            title: item.title,
            author: item.authors?.join(", "),
            description: item.description,
            thumbnail: item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail,
            categories: item.categories || []
          };
        }
      } catch (innerE) {
        console.warn("Direct fallback also failed:", innerE);
      }
    }

    if (!openLibCover && !googleMetadata) return null;

    return {
      title: googleMetadata?.title || title,
      author: googleMetadata?.author || author,
      description: googleMetadata?.description,
      thumbnail: this.upgradeImageUrl(
        openLibCover || googleMetadata?.thumbnail
      ),
      categories: googleMetadata?.categories || [],
    };
  },

  // --- Audiobooks Logic ---

  async browseAudiobooks(limit = 20): Promise<EnrichedAudiobook[]> {
    const { data, error } = await supabase
      .from("audiobook_metadata")
      .select("*, book:books(title, author, description, cover_url)")
      .order("scraped_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return this.enrichWithBookMetadata(data, false); // Change to false to ensure images are fetched if missing
  },

  /**
   * Helper function to calculate total duration from chapters
   */
  calculateTotalDuration(chapters: any[] | undefined | null): number {
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) return 0;
    return chapters.reduce((sum, ch) => {
      // Ensure we're adding numbers, fallback to 0
      const duration = typeof ch.duration_seconds === 'number' ? ch.duration_seconds : parseInt(String(ch.duration_seconds || 0), 10);
      return sum + (isNaN(duration) ? 0 : duration);
    }, 0);
  },

  /**
   * Main entry point for accurate duration calculation
   */
  calculateAudiobookDuration(ab: AudiobookRecord): number {
    const sumDuration = this.calculateTotalDuration(ab.chapters);
    // If chapters have durations, they are the source of truth
    if (sumDuration > 0) return sumDuration;
    // Otherwise fallback to the main duration_seconds field
    return ab.duration_seconds || 0;
  },

  async enrichWithBookMetadata(
    audiobooks: AudiobookRecord[],
    fast = false,
  ): Promise<EnrichedAudiobook[]> {
    if (audiobooks.length === 0) return [];

    const enriched: EnrichedAudiobook[] = [];

    for (const ab of audiobooks) {
      let canonical_author = ab.author;
      let canonical_description = ab.description;
      let canonical_cover_url = ab.cover_url;
      let foundNewMetadata = false;

      // Always calculate accurate duration from chapters if available
      const calculatedDuration = this.calculateAudiobookDuration(ab);
      
      if (calculatedDuration > 0 && calculatedDuration !== ab.duration_seconds) {
        foundNewMetadata = true;
      }

      // Skip heavy lookups in fast mode if we already have the basics
      if (fast && (ab.author && ab.cover_url && ab.cover_url.startsWith('http'))) {
        enriched.push({
          ...ab,
          canonical_author: ab.author,
          canonical_description: ab.description,
          canonical_cover_url: ab.cover_url,
          duration: this.formatDuration(calculatedDuration),
          duration_seconds: calculatedDuration
        });
        
        // Persist corrected duration in background even in fast mode
        if (foundNewMetadata) {
          supabase.from('audiobook_metadata')
            .update({ duration_seconds: calculatedDuration })
            .eq('id', ab.id)
            .then(({ error }) => {
              if (error) console.warn("Failed to persist fast duration update:", error);
            });
        }
        continue;
      }

      // 1. Try local match from JOIN first, then fallback to fuzzy search
      if (ab.book) {
        canonical_author = ab.book.author || canonical_author;
        canonical_description = ab.book.description || canonical_description;
        canonical_cover_url = ab.book.cover_url || canonical_cover_url;
      } else {
        const { data: matchedBooks } = await supabase
          .from("books")
          .select("title, author, description, cover_url, isbn")
          .ilike("title", `%${this.normalizeTitle(ab.title)}%`)
          .limit(1);

        if (matchedBooks && matchedBooks.length > 0) {
          const book = matchedBooks[0];
          canonical_author = book.author || canonical_author;
          canonical_description = canonical_description || book.description;
          canonical_cover_url = canonical_cover_url || book.cover_url;
        }
      }

      // 2. AI Translation / Metadata Enrichment
      if (!fast && (!ab.title_en || !ab.title_vi)) {
        try {
          const translations = await ai.translateMetadata(
            ab.title, 
            canonical_description || ab.description || "",
            canonical_author || ab.author || "",
            ab.narrator || ""
          );
          ab.title_en = translations.title_en;
          ab.title_vi = translations.title_vi;
          ab.description_en = translations.description_en;
          ab.description_vi = translations.description_vi;
          ab.author_en = translations.author_en;
          ab.author_vi = translations.author_vi;
          ab.narrator_en = translations.narrator_en;
          ab.narrator_vi = translations.narrator_vi;
          foundNewMetadata = true;
        } catch (e) {
          console.warn(`AI translation failed for ${ab.title}:`, e);
        }
      }

      // 3. Try external search if still missing cover or if it looks low-res
      // We consider anything with zoom=1,2,3,4,5 as potentially low-res for HD display
      const isGoogleLowRes = canonical_cover_url?.includes('google.com') && 
                            (canonical_cover_url.includes('zoom=1') || 
                             canonical_cover_url.includes('zoom=2') ||
                             canonical_cover_url.includes('zoom=5'));
      
      const isBadSource = canonical_cover_url?.includes('thuviensachnoi.vn') || 
                          canonical_cover_url?.includes('vcdn.com');
                             
      const isMissingOrLowRes = !canonical_cover_url || 
                               !canonical_cover_url.startsWith('http') || 
                               isGoogleLowRes || isBadSource;

      if (!fast && isMissingOrLowRes) {
        try {
          const external = await this.fetchMetadataBySearch(
            ab.title,
            ab.author || "",
            ab.title_en
          );
          if (external) {
            canonical_author = external.author || canonical_author || null;
            canonical_description = external.description || canonical_description || null;
            canonical_cover_url = external.thumbnail || canonical_cover_url;
            foundNewMetadata = true;
          }
        } catch (e) {
          console.warn(`External enrichment failed for ${ab.title}:`, e);
        }
      }
      
      const final_cover_url = this.upgradeImageUrl(canonical_cover_url || ab.cover_url) || null;

      // 5. Update database if we found better metadata, a new cover, or if calculated duration differs
      const durationChanged = calculatedDuration > 0 && calculatedDuration !== ab.duration_seconds;
      
      if (foundNewMetadata || (final_cover_url && final_cover_url !== ab.cover_url) || durationChanged) {
        // Run update in background
        supabase.from('audiobook_metadata')
          .update({
            author: canonical_author,
            description: canonical_description,
            cover_url: final_cover_url,
            duration_seconds: calculatedDuration,
            title_en: ab.title_en,
            title_vi: ab.title_vi,
            description_en: ab.description_en,
            description_vi: ab.description_vi,
            scraped_at: new Date().toISOString()
          })
          .eq('id', ab.id)
          .then(({ error }) => {
            if (error) console.warn("Failed to persist metadata update:", error);
          });
      }

      enriched.push({
        ...ab,
        canonical_author,
        canonical_description,
        canonical_cover_url: final_cover_url,
        duration: this.formatDuration(calculatedDuration),
        duration_seconds: calculatedDuration
      });
    }

    return enriched;
  },

  async searchAudiobooks(
    query: string,
    limit = 20,
  ): Promise<EnrichedAudiobook[]> {
    const { data, error } = await supabase.rpc("search_audiobooks", {
      query,
      lim: limit,
    });
    if (error || !data) return [];
    return this.enrichWithBookMetadata(data);
  },

  async getAudiobookByISBN(isbn: string): Promise<EnrichedAudiobook | null> {
    const { data, error } = await supabase
      .from("audiobook_metadata")
      .select("*, book:books(title, author, description, cover_url)")
      .eq("isbn", isbn)
      .maybeSingle();
    if (error || !data) return null;
    const enriched = await this.enrichWithBookMetadata([data]);
    return enriched[0];
  },

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0 phút';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let parts = [];
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    if (secs > 0 && hours === 0) parts.push(`${secs} giây`); // Only show seconds if less than an hour
    
    if (parts.length === 0) return '0 phút';
    
    return parts.join(' ');
  },

  getPlaybackUrl(record: AudiobookRecord): string {
    const R2_PUBLIC_URL = "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev";

    // Check tags array for r2_path entry
    if (record.tags) {
      const tagsArr = Array.isArray(record.tags) ? record.tags : [];
      const r2Tag = tagsArr.find((t: any) => typeof t === 'string' && t.startsWith('r2_path:'));
      if (r2Tag) {
        const r2Path = (r2Tag as string).replace('r2_path:', '');
        return `${R2_PUBLIC_URL}/${encodeURIComponent(r2Path)}`;
      }
      // Also handle JSONB tags object with r2_path property
      if (typeof record.tags === 'object' && !Array.isArray(record.tags) && (record.tags as any)?.r2_path) {
        return `${R2_PUBLIC_URL}/${encodeURIComponent((record.tags as any).r2_path)}`;
      }
    }

    // If source_url already points to R2 public URL or worker, use it directly (will replace worker URL with public if it matches)
    let url = record.source_url;
    if (url && url.includes('workers.dev')) {
       url = url.replace('https://r2-audio-worker.vuduytien20042004.workers.dev', R2_PUBLIC_URL);
       return url;
    }
    if (url && url.includes('r2.dev')) {
      return url;
    }

    // Fallback: check if it's a playable audio URL
    if (url && (url.includes('.mp3') || url.includes('.m4a') || url.includes('.wav') || url.includes('.mp4'))) {
      return url;
    }

    return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  },

  getChapterUrl(record: AudiobookRecord, chapterIndex: number): string {
    const basePlaybackUrl = this.getPlaybackUrl(record);
    if (!record.chapters || record.chapters.length <= 1) return basePlaybackUrl;

    const firstChapterIndex = record.chapters[0]?.index || 1;
    if (chapterIndex === firstChapterIndex) return basePlaybackUrl;

    const offset = chapterIndex - firstChapterIndex;
    if (offset === 0) return basePlaybackUrl;

    const parts = basePlaybackUrl.split('/');
    const filename = parts[parts.length - 1]; 
    const decodedFilename = decodeURIComponent(filename);
    
    // Find the FIRST number in the filename.
    const numberMatch = decodedFilename.match(/\d+/);
    if (numberMatch) {
       const originalNumStr = numberMatch[0];
       const originalNum = parseInt(originalNumStr, 10);
       const targetNum = originalNum + offset;
       
       let newNumStr = targetNum.toString();
       if (originalNumStr.startsWith('0') && originalNumStr.length > 1) {
          newNumStr = newNumStr.padStart(originalNumStr.length, '0');
       }
       const newFilename = decodedFilename.replace(originalNumStr, newNumStr);
       parts[parts.length - 1] = encodeURIComponent(newFilename);
       return parts.join('/');
    }
    
    return basePlaybackUrl;
  },

  // --- Recommendations ---

  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<Book[]> {
    try {
      const { data: history, error: historyError } = await supabase
        .from("borrow_records")
        .select("book_id, books(category)")
        .eq("user_id", userId);

      if (historyError) throw historyError;

      const genreCounts: Record<string, number> = {};
      const borrowedIsbns: string[] = [];

      history?.forEach((record: any) => {
        borrowedIsbns.push(record.book_id);
        const category = (record.books as any)?.category;
        if (category && category !== "Uncategorized") {
          genreCounts[category] = (genreCounts[category] || 0) + 1;
        }
      });

      const favoriteGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([genre]) => genre);

      let recommendedBooks: Book[] = [];

      if (favoriteGenres.length > 0) {
        const { data: books, error: bookError } = await supabase
          .from("books")
          .select("*")
          .in("category", favoriteGenres.slice(0, 3))
          .not("isbn", "in", `(${borrowedIsbns.join(",") || '""'})`)
          .order("average_rating", { ascending: false })
          .limit(limit);

        if (!bookError) recommendedBooks = books || [];
      }

      if (recommendedBooks.length < limit) {
        const { data: popularBooks, error: popularError } = await supabase
          .from("books")
          .select("*")
          .not("isbn", "in", `(${borrowedIsbns.join(",") || '""'})`)
          .order("average_rating", { ascending: false })
          .limit(limit - recommendedBooks.length);

        if (!popularError && popularBooks)
          recommendedBooks = [...recommendedBooks, ...popularBooks];
      }

      return recommendedBooks;
    } catch (error) {
      console.error("[booksService] Recommendation error:", error);
      return [];
    }
  },

  async getSemanticRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<Book[]> {
    try {
      const { data: history, error: historyError } = await supabase
        .from("borrow_records")
        .select("books(title, author, category, description)")
        .eq("user_id", userId)
        .order("borrowed_at", { ascending: false })
        .limit(5);

      if (historyError || !history || history.length === 0) {
        return this.getPersonalizedRecommendations(userId, limit);
      }

      const profileText = history
        .map(
          (h: any) => `${h.books.title} ${h.books.author} ${h.books.category}`,
        )
        .join(" ");

      const profileEmbedding = await ai.generateEmbedding(profileText);

      const { data: recommendations, error: matchError } = await supabase.rpc(
        "match_books",
        {
          query_embedding: profileEmbedding,
          match_threshold: 0.4,
          match_count: limit + 5,
        },
      );

      if (matchError) throw matchError;

      const borrowedTitles = history.map((h: any) => h.books.title);
      return (recommendations || [])
        .filter((b: any) => !borrowedTitles.includes(b.title))
        .slice(0, limit);
    } catch (error) {
      console.error("[booksService] Semantic error:", error);
      return this.getPersonalizedRecommendations(userId, limit);
    }
  },

  async getSimilarBooks(isbn: string, limit = 5): Promise<Book[]> {
    try {
      const { data: currentBook } = await supabase
        .from("books")
        .select("embedding")
        .eq("isbn", isbn)
        .single();
      
      if (!currentBook?.embedding) return [];

      const { data: recommendations, error: matchError } = await supabase.rpc(
        "match_books",
        {
          query_embedding: currentBook.embedding,
          match_threshold: 0.4,
          match_count: limit + 1,
        },
      );

      if (matchError) throw matchError;

      return (recommendations || [])
        .filter((b: any) => b.isbn !== isbn)
        .slice(0, limit);
    } catch (error) {
      console.error("[booksService] Similar books error:", error);
      return [];
    }
  },

  async getAudiobookBySourceId(
    platform: string,
    sourceId: string,
  ): Promise<EnrichedAudiobook | null> {
    const { data, error } = await supabase
      .from("audiobook_metadata")
      .select("*, book:books(title, author, description, cover_url)")
      .eq("source_platform", platform)
      .eq("source_id", sourceId)
      .maybeSingle();
    if (error || !data) return null;
    const enriched = await this.enrichWithBookMetadata([data]);
    return enriched[0];
  },

  async syncBookMetadata(isbn: string) {
    const metadata = await this.fetchBookMetadata(isbn);
    if (!metadata) return null;

    // Check if book exists
    const { data: existing } = await supabase
      .from("books")
      .select("isbn")
      .eq("isbn", isbn)
      .maybeSingle();

    const payload = {
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      cover_url: metadata.thumbnail,
      published_date: metadata.publishedDate,
      category: metadata.categories?.[0] || "Uncategorized",
      language: metadata.language,
      average_rating: metadata.averageRating,
      edition: metadata.edition,
      isbn: metadata.isbn,
      title_en: metadata.title_en,
      title_vi: metadata.title_vi,
      description_en: metadata.description_en,
      description_vi: metadata.description_vi,
      author_en: metadata.author_en,
      author_vi: metadata.author_vi,
    };

    if (existing) {
      const { data, error } = await supabase
        .from("books")
        .update(payload)
        .eq("isbn", isbn)
        .select()
        .single();
      if (error) throw error;
      return { data, isNew: false };
    } else {
      return { data: payload, isNew: true }; // Just return for preview in the form
    }
  },

  async bulkEnrichAudiobooks() {
    const { data: audiobooks, error: fetchError } = await supabase
      .from("audiobook_metadata")
      .select("*");

    if (fetchError) throw fetchError;
    if (!audiobooks || audiobooks.length === 0) return { count: 0 };

    const enriched = await this.enrichWithBookMetadata(audiobooks, false); // false = full enrichment

    let updatedCount = 0;
    for (const item of enriched) {
      if (
        item.canonical_author ||
        item.canonical_cover_url ||
        item.canonical_description
      ) {
        const { error: updateError } = await supabase
          .from("audiobook_metadata")
          .update({
            author: item.canonical_author || item.author,
            cover_url: item.canonical_cover_url || item.cover_url,
            description: item.canonical_description || item.description,
            title_en: item.title_en,
            title_vi: item.title_vi,
            description_en: item.description_en,
            description_vi: item.description_vi,
            author_en: item.author_en,
            author_vi: item.author_vi,
            narrator_en: item.narrator_en,
            narrator_vi: item.narrator_vi,
            duration_seconds: item.duration_seconds,
            tags: {
              ...(item.tags || {}),
              is_enriched: true,
              enriched_at: new Date().toISOString(),
            },
          } as any)
          .eq("id", item.id);

        if (!updateError) updatedCount++;
      }
    }

    return { total: audiobooks.length, updated: updatedCount };
  },
};
