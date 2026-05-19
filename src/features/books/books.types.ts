export interface Book {
  isbn: string;
  title: string;
  author: string | null;
  total_copies: number;
  available_copies: number;
  cover_url: string | null;
  google_data?: any;
  category?: string;
  description?: string;
  published_date?: string;
  page_count?: number;
  language?: string;
  average_rating?: number;
  ratings_count?: number;
  edition?: string;
  title_en?: string;
  title_vi?: string;
  description_en?: string;
  description_vi?: string;
  author_en?: string;
  author_vi?: string;
  appendix?: string;
}

export interface BookMetadata {
  title: string;
  author: string;
  description?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  thumbnail?: string;
  isbn?: string;
  language?: string;
  averageRating?: number;
  ratingsCount?: number;
  edition?: string;
  author_en?: string;
  author_vi?: string;
  description_en?: string;
  description_vi?: string;
  title_en?: string;
  title_vi?: string;
  syncSource?: {
    google: boolean;
    openLib: boolean;
  };
}

export interface AudiobookRecord {
  id: string;
  source_platform: 'fonos' | 'voizfm' | 'thuviensachnoi' | 'r2';
  source_id: string;
  source_url: string;
  preview_url: string | null;
  title: string;
  title_en?: string;
  title_vi?: string;
  author: string | null;
  narrator: string | null;
  description: string | null;
  description_en?: string;
  description_vi?: string;
  author_en?: string;
  author_vi?: string;
  narrator_en?: string;
  narrator_vi?: string;
  publisher: string | null;
  isbn: string | null;
  language: string;
  cover_url: string | null;
  duration_seconds: number | null;
  chapters: Array<{ index: number; title: string; duration_seconds: number | null }>;
  categories: string[];
  tags: {
    category?: string;
    r2_path?: string;
    is_enriched?: boolean;
    enriched_at?: string;
    [key: string]: any;
  } | null;
  book?: {
    title: string;
    author: string | null;
    description: string | null;
    cover_url: string | null;
  } | null;
  price: number | null;
  is_free: boolean;
  is_premium: boolean;
  rating: number | null;
  review_count: number;
  published_at: string | null;
  scraped_at: string;
}

export interface EnrichedAudiobook extends AudiobookRecord {
  canonical_author: string | null;
  canonical_description: string | null;
  canonical_cover_url: string | null;
  duration?: string | null;
}
