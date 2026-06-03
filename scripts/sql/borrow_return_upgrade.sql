-- 1. Hàm mượn sách nâng cao (Advanced Borrow)
CREATE OR REPLACE FUNCTION borrow_book(p_book_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role "Role";
    v_is_locked BOOLEAN;
    v_borrow_count INT;
    v_max_books INT;
    v_available_copies INT;
    v_due_interval INTERVAL;
    v_record_id UUID;
BEGIN
    -- Lấy thông tin người dùng
    SELECT role, is_locked, max_books INTO v_user_role, v_is_locked, v_max_books
    FROM profiles WHERE id = p_user_id;

    IF v_is_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tài khoản đang bị khóa');
    END IF;

    -- Kiểm tra số lượng đang mượn
    SELECT COUNT(*) INTO v_borrow_count FROM borrow_records 
    WHERE user_id = p_user_id AND status = 'BORROWED';

    IF v_borrow_count >= v_max_books THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn đã đạt giới hạn mượn sách tối đa');
    END IF;

    -- Kiểm tra sách và khóa hàng
    SELECT available_copies INTO v_available_copies FROM books WHERE id = p_book_id FOR UPDATE;
    
    IF v_available_copies IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy sách');
    END IF;

    IF v_available_copies <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sách đã hết trong kho');
    END IF;

    -- Thiết lập hạn trả (Admin mượn lâu hơn)
    IF v_user_role = 'ADMIN' THEN
        v_due_interval := '30 days';
    ELSE
        v_due_interval := '14 days';
    END IF;

    -- Thực hiện mượn
    INSERT INTO borrow_records (book_id, user_id, due_date, status)
    VALUES (p_book_id, p_user_id, CURRENT_TIMESTAMP + v_due_interval, 'BORROWED')
    RETURNING id INTO v_record_id;

    UPDATE books SET available_copies = available_copies - 1 WHERE id = p_book_id;

    RETURN jsonb_build_object(
        'success', true, 
        'record_id', v_record_id, 
        'message', 'Mượn sách thành công',
        'due_date', (CURRENT_TIMESTAMP + v_due_interval)
    );
END;
$$;

-- 2. Hàm trả sách và tính phí phạt (Return & Fine Calculation)
CREATE OR REPLACE FUNCTION return_book(p_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_book_id UUID;
    v_due_date TIMESTAMP;
    v_days_overdue INT;
    v_fine_amount DECIMAL(10,2) := 0;
    v_fine_per_day INT := 2000; -- Mặc định 2000đ/ngày, có thể lấy từ SystemConfig sau
BEGIN
    SELECT book_id, due_date INTO v_book_id, v_due_date
    FROM borrow_records WHERE id = p_record_id AND status = 'BORROWED' FOR UPDATE;

    IF v_book_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy bản ghi mượn hoặc sách đã trả');
    END IF;

    -- Tính phí phạt nếu quá hạn
    v_days_overdue := DATE_PART('day', CURRENT_TIMESTAMP - v_due_date);
    IF v_days_overdue > 0 THEN
        v_fine_amount := v_days_overdue * v_fine_per_day;
    END IF;

    -- Cập nhật bản ghi trả sách
    UPDATE borrow_records 
    SET returned_at = CURRENT_TIMESTAMP, 
        status = 'RETURNED',
        fine_amount = v_fine_amount
    WHERE id = p_record_id;

    -- Tăng số lượng sách trong kho
    UPDATE books SET available_copies = available_copies + 1 WHERE id = v_book_id;

    -- Nếu có phí phạt, tạo một giao dịch PENDING
    IF v_fine_amount > 0 THEN
        INSERT INTO transactions (borrow_record_id, amount, status, method)
        VALUES (p_record_id, v_fine_amount, 'PENDING', 'CASH');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Trả sách thành công',
        'fine_amount', v_fine_amount,
        'days_overdue', GREATEST(0, v_days_overdue)
    );
END;
$$;
