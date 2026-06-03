-- RPC Thanh toán phí phạt với logic phân loại phương thức
CREATE OR REPLACE FUNCTION pay_fine(p_record_id UUID, p_method TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fine_amount DECIMAL(10,2);
    v_status TEXT;
BEGIN
    -- Lấy số tiền phạt hiện tại
    SELECT fine_amount INTO v_fine_amount FROM borrow_records WHERE id = p_record_id;

    IF v_fine_amount IS NULL OR v_fine_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không có khoản nợ nào cần thanh toán');
    END IF;

    -- Xác định trạng thái dựa trên phương thức (Theo yêu cầu Turn 5)
    IF p_method = 'VIETQR' THEN
        v_status := 'COMPLETED';
        -- Tự động xóa nợ trong borrow_records
        UPDATE borrow_records SET fine_amount = 0 WHERE id = p_record_id;
    ELSE
        v_status := 'PENDING';
    END IF;

    -- Lưu vết giao dịch
    INSERT INTO transactions (borrow_record_id, amount, status, method, created_at)
    VALUES (p_record_id, v_fine_amount, v_status, p_method, now());

    RETURN jsonb_build_object(
        'success', true, 
        'message', CASE WHEN v_status = 'COMPLETED' THEN 'Thanh toán thành công và đã xóa nợ' ELSE 'Yêu cầu thanh toán đang chờ Thủ thư xác nhận' END,
        'status', v_status
    );
END;
$$;
