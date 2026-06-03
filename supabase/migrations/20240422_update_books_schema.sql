-- 1. Thêm cột isbn tạm thời vào borrow_records để ánh xạ
ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS book_isbn TEXT;

-- 2. Cập nhật isbn từ bảng books cũ sang borrow_records
UPDATE borrow_records br
SET book_isbn = b.isbn
FROM books b
WHERE br.book_id = b.id;

-- 3. Xóa các bản ghi mượn sách không có ISBN (vì ISBN sẽ là PK)
DELETE FROM borrow_records WHERE book_isbn IS NULL;

-- 4. Xóa Ràng buộc Khóa ngoại cũ
ALTER TABLE borrow_records DROP CONSTRAINT IF EXISTS borrow_records_book_id_fkey;

-- 5. Cấu trúc lại bảng books
-- Đảm bảo isbn không null và unique trước khi đặt làm PK
DELETE FROM books WHERE isbn IS NULL;
ALTER TABLE books ALTER COLUMN isbn SET NOT NULL;
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_pkey CASCADE;
ALTER TABLE books ADD PRIMARY KEY (isbn);

-- 6. Thêm cột google_data
ALTER TABLE books ADD COLUMN IF NOT EXISTS google_data JSONB DEFAULT '{}';

-- 7. Dọn dẹp cột cũ trong books
ALTER TABLE books DROP COLUMN IF EXISTS id;

-- 8. Cấu trúc lại borrow_records
ALTER TABLE borrow_records DROP COLUMN IF EXISTS book_id;
ALTER TABLE borrow_records RENAME COLUMN book_isbn TO book_id;
ALTER TABLE borrow_records ALTER COLUMN book_id SET NOT NULL;

-- 9. Thêm Khóa ngoại mới
ALTER TABLE borrow_records 
ADD CONSTRAINT borrow_records_book_id_fkey 
FOREIGN KEY (book_id) REFERENCES books(isbn) ON DELETE CASCADE;

-- 10. (Tùy chọn) Bật RLS cho bảng books nếu chưa có
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access" ON books;
CREATE POLICY "Public Read Access" ON books FOR SELECT USING (true);
DROP POLICY IF EXISTS "Librarian All Access" ON books;
CREATE POLICY "Librarian All Access" ON books FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('LIBRARIAN', 'ADMIN')
  )
);
