-- ============================================================
-- BIBLIOTECH ADMIN MANAGEMENT RPCs
-- Adds administrative business logic for borrowing and reporting
-- ============================================================

-- 1. Approve Borrowing Request
CREATE OR REPLACE FUNCTION public.approve_borrow(
    p_record_id UUID,
    p_librarian_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_book_isbn TEXT;
BEGIN
    -- Check if record exists and is pending
    SELECT user_id, book_id INTO v_user_id, v_book_isbn
    FROM public.borrow_records
    WHERE id = p_record_id AND status = 'BORROWED' -- In our system, BORROWED means active/pending approval in some contexts
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bản ghi không tồn tại hoặc đã được xử lý.');
    END IF;

    -- Update record
    UPDATE public.borrow_records
    SET status = 'BORROWED', -- Ensure it's active
        updated_at = now()
    WHERE id = p_record_id;

    -- Log action (if trigger not present)
    INSERT INTO public.audit_logs (actor_id, action_type, target_id, severity)
    VALUES (p_librarian_id, 'BORROW_APPROVE', p_record_id, 'INFO');

    RETURN jsonb_build_object('success', true, 'message', 'Đã duyệt yêu cầu mượn sách.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reject Borrowing Request
CREATE OR REPLACE FUNCTION public.reject_borrow(
    p_record_id UUID,
    p_librarian_id UUID,
    p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
    v_book_isbn TEXT;
BEGIN
    SELECT book_id INTO v_book_isbn
    FROM public.borrow_records
    WHERE id = p_record_id AND status = 'BORROWED'
    FOR UPDATE;

    IF v_book_isbn IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bản ghi không tồn tại hoặc đã được xử lý.');
    END IF;

    -- Update record
    UPDATE public.borrow_records
    SET status = 'REJECTED',
        updated_at = now()
    WHERE id = p_record_id;

    -- Return book copy to inventory
    UPDATE public.books
    SET available_copies = available_copies + 1
    WHERE isbn = v_book_isbn;

    -- Log action
    INSERT INTO public.audit_logs (actor_id, action_type, target_id, metadata, severity)
    VALUES (p_librarian_id, 'BORROW_REJECT', p_record_id, jsonb_build_object('reason', p_reason), 'INFO');

    RETURN jsonb_build_object('success', true, 'message', 'Đã từ chối yêu cầu mượn sách.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Generate Library Report
CREATE OR REPLACE FUNCTION public.generate_library_report(report_type TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF report_type = 'BORROWING' THEN
        SELECT jsonb_build_object(
            'total_borrows', (SELECT count(*) FROM public.borrow_records),
            'active_borrows', (SELECT count(*) FROM public.borrow_records WHERE status = 'BORROWED'),
            'overdue_borrows', (SELECT count(*) FROM public.borrow_records WHERE status = 'BORROWED' AND due_date < now())
        ) INTO v_result;
    ELSIF report_type = 'INVENTORY' THEN
        SELECT jsonb_build_object(
            'total_books', (SELECT count(*) FROM public.books),
            'total_copies', (SELECT sum(total_copies) FROM public.books),
            'available_copies', (SELECT sum(available_copies) FROM public.books)
        ) INTO v_result;
    ELSE
        v_result := jsonb_build_object('message', 'Loại báo cáo không hợp lệ');
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Get Library Analytics
CREATE OR REPLACE FUNCTION public.get_library_analytics(range TEXT)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'labels', ARRAY['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], -- Mock for now
        'data', ARRAY[10, 25, 45, 30, 55, 70]
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.approve_borrow(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_borrow(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_library_report(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_library_analytics(TEXT) TO authenticated;
