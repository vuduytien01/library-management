-- Hoàn thiện nghiệp vụ Trả sách theo ISBN và Phí phạt 5,000đ/ngày
CREATE OR REPLACE FUNCTION return_book_by_isbn(p_isbn TEXT, p_librarian_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id UUID;
    v_book_id UUID;
    v_due_date TIMESTAMP;
    v_days_overdue INT;
    v_fine_amount DECIMAL(10,2) := 0;
    v_fine_per_day INT := 5000; -- Theo plan resolved.8
BEGIN
    -- Tìm bản ghi mượn gần nhất của ISBN này
    SELECT br.id, br.book_id, br.due_date INTO v_record_id, v_book_id, v_due_date
    FROM borrow_records br
    JOIN books b ON br.book_id = b.id
    WHERE b.isbn13 = p_isbn OR b.isbn10 = p_isbn
    AND br.status = 'BORROWED'
    ORDER BY br.borrowed_at DESC
    LIMIT 1;

    IF v_record_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy bản ghi mượn đang hoạt động cho ISBN này');
    END IF;

    -- Tính phí phạt
    v_days_overdue := DATE_PART('day', CURRENT_TIMESTAMP - v_due_date);
    IF v_days_overdue > 0 THEN
        v_fine_amount := v_days_overdue * v_fine_per_day;
    END IF;

    -- Cập nhật bản ghi
    UPDATE borrow_records 
    SET returned_at = CURRENT_TIMESTAMP, 
        status = 'RETURNED',
        fine_amount = v_fine_amount,
        processed_by = p_librarian_id
    WHERE id = v_record_id;

    -- Tăng kho
    UPDATE books SET available_copies = LEAST(available_copies + 1, total_copies) WHERE id = v_book_id;

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
END;
$$;
