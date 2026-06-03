export interface SystemConfig {
  fine_rate: number;
  member_due_days: number;
  admin_due_days: number;
  max_books: number;
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
  book?: any; 
  user?: {
    fullName: string;
    avatarUrl?: string;
  };
}

export interface MemberProfile {
  id: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
  points: number;
  level: number;
  membership_code: string;
}

export interface Annotation {
  id: string;
  book_id: string;
  user_id: string;
  content: string;
  page_number?: number;
  created_at: string;
  is_public: boolean;
  color?: string;
  user?: {
    fullName: string;
    avatarUrl?: string;
  };
}

export interface DownloadedFile {
  id: string;
  title: string;
  uri: string;
  type: 'EPUB' | 'MP3';
  downloaded_at: string;
}

