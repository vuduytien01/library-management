-- Tạo function kiểm tra tính hợp lệ khi mượn sách của người dùng
-- Logic:
-- 1. Nếu có sách mượn quá hạn > 7 ngày => KHÔNG hợp lệ (OVERDUE_7_DAYS)
-- 2. Nếu nợ phí phạt > 50.000đ => KHÔNG hợp lệ (UNPAID_FINE_50K)
-- 3. Ngược lại => Hợp lệ

CREATE OR REPLACE FUNCTION check_borrow_eligibility(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_overdue_count INT;
    v_total_fine NUMERIC;
    v_result JSONB;
BEGIN
    -- 1. Kiểm tra sách quá hạn > 7 ngày
    SELECT COUNT(*) INTO v_overdue_count
    FROM borrow_records
    WHERE user_id = p_user_id
      AND status = 'BORROWED'
      AND due_date < (CURRENT_DATE - INTERVAL '7 days');

    IF v_overdue_count > 0 THEN
        v_result := jsonb_build_object(
            'eligible', false,
            'reason', 'OVERDUE_7_DAYS'
        );
        RETURN v_result;
    END IF;

    -- 2. Kiểm tra tổng phí phạt chưa đóng > 50.000đ
    -- Lưu ý: Nếu cột estimated_fine dùng để lưu trữ phí, hoặc chúng ta tính dựa trên return_date
    -- Ở đây giả sử estimated_fine lưu số tiền phạt cho các sách (đã trả muộn chưa đóng tiền hoặc đang mượn quá hạn)
    SELECT COALESCE(SUM(estimated_fine), 0) INTO v_total_fine
    FROM borrow_records
    WHERE user_id = p_user_id
      AND fine_paid = false;

    IF v_total_fine > 50000 THEN
        v_result := jsonb_build_object(
            'eligible', false,
            'reason', 'UNPAID_FINE_50K'
        );
        RETURN v_result;
    END IF;

    -- 3. Hợp lệ
    v_result := jsonb_build_object(
        'eligible', true,
        'reason', null
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
