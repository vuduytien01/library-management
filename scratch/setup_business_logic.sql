
-- HÀM TRẢ SÁCH SIÊU TỐC (ISBN Based)
CREATE OR REPLACE FUNCTION public.return_book(p_isbn TEXT, p_librarian_id UUID)
RETURNS JSON AS $$
DECLARE
    v_record_id UUID;
    v_book_id UUID;
    v_due_date TIMESTAMP WITH TIME ZONE;
    v_fine NUMERIC := 0;
    v_days_late INTEGER;
BEGIN
    -- 1. Tìm bản ghi mượn đang hoạt động của ISBN này
    SELECT br.id, br.book_id, br.due_date 
    INTO v_record_id, v_book_id, v_due_date
    FROM public.borrow_records br
    JOIN public.books b ON br.book_id = b.id
    WHERE b.isbn = p_isbn AND br.status = 'BORROWED'
    ORDER BY br.borrowed_at ASC
    LIMIT 1;

    IF v_record_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Không tìm thấy bản ghi mượn đang hoạt động cho ISBN này.');
    END IF;

    -- 2. Tính tiền phạt (5,000đ / ngày)
    v_days_late := EXTRACT(DAY FROM (now() - v_due_date));
    IF v_days_late > 0 THEN
        v_fine := v_days_late * 5000;
    END IF;

    -- 3. Cập nhật bản ghi mượn
    UPDATE public.borrow_records
    SET 
        status = 'RETURNED',
        returned_at = now(),
        fine_amount = v_fine
    WHERE id = v_record_id;

    -- 4. Tăng số lượng sách sẵn có
    UPDATE public.books
    SET available_copies = available_copies + 1
    WHERE id = v_book_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Trả sách thành công', 
        'fine_amount', v_fine,
        'days_late', GREATEST(v_days_late, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- HÀM NỘP PHẠT (QR / Cash)
CREATE OR REPLACE FUNCTION public.pay_fine(p_record_id UUID, p_method TEXT)
RETURNS JSON AS $$
BEGIN
    UPDATE public.borrow_records
    SET fine_amount = 0
    WHERE id = p_record_id;

    RETURN json_build_object('success', true, 'message', 'Đã xóa nợ thành công');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
