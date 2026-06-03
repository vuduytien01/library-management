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
  appendix?: string;
  author_en?: string;
  author_vi?: string;
}

export interface BorrowRecord {
  id: string;
  book_id: string;
  user_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: string;
  fine_amount: number;
  estimated_fine?: number;
  book?: Book;
  user?: {
    fullName: string;
    avatarUrl?: string;
  };
}
