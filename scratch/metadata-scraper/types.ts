export interface Chapter {
  index: number;
  title: string;
  duration_seconds: number | null;
}

export interface AudiobookMetadata {
  source_platform: 'fonos' | 'voizfm' | 'thuviensachnoi';
  source_id: string;
  source_url: string;

  // Core
  title: string;
  author: string | null;
  narrator: string | null;
  description: string | null;
  publisher: string | null;
  isbn: string | null;
  language: string;

  // Media
  cover_url: string | null;
  duration_seconds: number | null;

  // Chapters
  chapters: Chapter[];

  // Classification
  categories: string[];
  tags: string[];

  // Commercial
  price: number | null;
  is_free: boolean;

  // Ratings
  rating: number | null;
  review_count: number;

  // Date
  published_at: string | null;
}
