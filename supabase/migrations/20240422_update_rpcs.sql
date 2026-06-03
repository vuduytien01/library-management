-- 1. Cập nhật borrow_book sử dụng ISBN (TEXT)
CREATE OR REPLACE FUNCTION borrow_book(p_isbn TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available_copies INT;
    v_record_id UUID;
BEGIN
    -- Kiểm tra và LOCK bản ghi sách theo ISBN
    SELECT available_copies INTO v_available_copies
    FROM books
    WHERE isbn = p_isbn
    FOR UPDATE;

    IF v_available_copies IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy sách với ISBN này');
    END IF;

    IF v_available_copies <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sách đã hết bản copy sẵn có');
    END IF;

    -- Kiểm tra giới hạn mượn (max 5 sách)
    IF (SELECT COUNT(*) FROM borrow_records WHERE user_id = p_user_id AND status = 'BORROWED') >= 5 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn đã đạt giới hạn mượn 5 cuốn sách');
    END IF;

    -- Tạo bản ghi mượn
    INSERT INTO borrow_records (book_id, user_id, due_date, status)
    VALUES (p_isbn, p_user_id, CURRENT_TIMESTAMP + INTERVAL '14 days', 'BORROWED')
    RETURNING id INTO v_record_id;

    -- Giảm số lượng copy
    UPDATE books
    SET available_copies = available_copies - 1
    WHERE isbn = p_isbn;

    RETURN jsonb_build_object(
        'success', true, 
        'record_id', v_record_id, 
        'message', 'Đăng ký mượn sách thành công'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 2. Cập nhật return_book_by_isbn sử dụng ISBN (TEXT)
CREATE OR REPLACE FUNCTION return_book_by_isbn(p_isbn TEXT, p_librarian_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id UUID;
    v_due_date TIMESTAMP;
    v_days_overdue INT;
    v_fine_amount DECIMAL(10,2) := 0;
    v_fine_per_day INT := 2000; -- Phí phạt chuẩn 2,000đ/ngày
BEGIN
    -- Tìm bản ghi mượn gần nhất của ISBN này
    SELECT id, due_date INTO v_record_id, v_due_date
    FROM borrow_records
    WHERE book_id = p_isbn AND status = 'BORROWED'
    ORDER BY borrowed_at DESC
    LIMIT 1;

    IF v_record_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy bản ghi mượn đang hoạt động cho ISBN này');
    END IF;

    -- Tính phí phạt
    v_days_overdue := DATE_PART('day', CURRENT_TIMESTAMP - v_due_date);
    IF v_days_overdue > 0 THEN
        v_fine_amount := v_days_overdue * v_fine_per_day;
    END IF;

    -- Cập nhật bản ghi mượn
    UPDATE borrow_records 
    SET returned_at = CURRENT_TIMESTAMP, 
        status = 'RETURNED',
        fine_amount = v_fine_amount
    WHERE id = v_record_id;

    -- Tăng số lượng copy sẵn có
    UPDATE books 
    SET available_copies = LEAST(available_copies + 1, total_copies) 
    WHERE isbn = p_isbn;

    -- Tạo giao dịch nếu có phí phạt
    IF v_fine_amount > 0 THEN
        INSERT INTO transactions (borrow_record_id, amount, status, method)
        VALUES (v_record_id, v_fine_amount, 'PENDING', 'CASH');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Trả sách thành công',
        'fine_amount', v_fine_amount,
        'days_overdue', GREATEST(0, v_days_overdue)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
