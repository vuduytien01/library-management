-- 1. TRIGGER TỰ ĐỘNG CẬP NHẬT SỐ LƯỢNG SÁCH
-- Hàm này sẽ tự động trừ available_copies khi status là 'BORROWED' và cộng lại khi là 'RETURNED' hay 'CANCELLED'
CREATE OR REPLACE FUNCTION public.sync_book_inventory()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.status = 'BORROWED') THEN
            UPDATE public.books 
            SET available_copies = available_copies - 1 
            WHERE id = NEW.book_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Đổi từ trạng thái khác sang BORROWED
        IF (OLD.status != 'BORROWED' AND NEW.status = 'BORROWED') THEN
            UPDATE public.books 
            SET available_copies = available_copies - 1 
            WHERE id = NEW.book_id;
        -- Đổi từ BORROWED sang trạng thái kết thúc (RETURNED/CANCELLED)
        ELSIF (OLD.status = 'BORROWED' AND NEW.status IN ('RETURNED', 'CANCELLED')) THEN
            UPDATE public.books 
            SET available_copies = available_copies + 1 
            WHERE id = NEW.book_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_inventory ON public.borrow_records;
CREATE TRIGGER tr_sync_inventory
AFTER INSERT OR UPDATE ON public.borrow_records
FOR EACH ROW EXECUTE FUNCTION public.sync_book_inventory();

-- 2. RPC BỔ NHIỆM HỖ TRỢ (ADMIN/ASSISTANT)
-- Thủ thư có quyền nâng cấp Member thành ADMIN để hỗ trợ công việc
CREATE OR REPLACE FUNCTION public.appoint_assistant(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role "Role";
BEGIN
    -- Kiểm tra người gọi (phải là LIBRARIAN)
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    
    IF v_caller_role != 'LIBRARIAN' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Chỉ Thủ thư mới có quyền bổ nhiệm hỗ trợ');
    END IF;

    -- Thực hiện nâng cấp quyền
    UPDATE public.profiles 
    SET role = 'ADMIN', updated_at = now()
    WHERE id = p_member_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã bổ nhiệm thành công hỗ trợ viên');
END;
$$;
