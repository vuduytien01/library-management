UPDATE public.audiobook_metadata
SET
  title = 'Đường Xưa Mây Trắng',
  title_vi = 'Đường Xưa Mây Trắng',
  title_en = 'Old Path White Clouds',
  author = 'Thích Nhất Hạnh',
  author_vi = 'Thích Nhất Hạnh',
  author_en = 'Thich Nhat Hanh',
  cover_url = 'https://covers.openlibrary.org/b/id/715886-L.jpg',
  categories = ARRAY['Religion', 'Buddhism'],
  language = 'vi',
  updated_at = NOW()
WHERE source_platform = 'r2'
  AND source_id = 'Đường Xưa Mây Trắng.mp3';

UPDATE public.audiobook_metadata
SET
  title = 'Hành trình về phương Đông',
  title_vi = 'Hành trình về phương Đông',
  title_en = 'Journey to the East',
  author = 'Baird T. Spalding',
  author_vi = 'Baird T. Spalding',
  author_en = 'Baird T. Spalding',
  cover_url = 'https://books.google.com/books/content?id=4RrtDwAAQBAJ&printsec=frontcover&img=1&zoom=0&source=gbs_api',
  categories = ARRAY['Spirituality'],
  language = 'vi',
  updated_at = NOW()
WHERE source_platform = 'r2'
  AND source_id = 'Hành trình về phương Đông.mp3';

UPDATE public.audiobook_metadata
SET
  title = 'CHỦ NGHĨA KHẮC KỶ',
  title_vi = 'Chủ nghĩa khắc kỷ',
  title_en = 'A Guide to the Good Life: The Ancient Art of Stoic Joy',
  author = 'William B. Irvine',
  author_vi = 'William B. Irvine',
  author_en = 'William B. Irvine',
  cover_url = 'https://covers.openlibrary.org/b/isbn/9780195374612-L.jpg',
  isbn = '9780195374612',
  categories = ARRAY['Philosophy', 'Stoicism'],
  language = 'vi',
  updated_at = NOW()
WHERE source_platform = 'r2'
  AND source_id = 'CHỦ NGHĨA KHẮC KỶ.mp3';
