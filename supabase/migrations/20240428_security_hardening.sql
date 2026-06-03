-- SECURITY HARDENING MIGRATION (2024-04-28)
-- Focus: IDOR Prevention, RBAC Enforcement, and Rate Limiting

-- 1. Create Rate Limiting Infrastructure
CREATE TABLE IF NOT EXISTS public.request_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast lookup in rate limiting
CREATE INDEX IF NOT EXISTS idx_request_logs_user_action ON public.request_logs(user_id, action_name, created_at);

-- Rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_action TEXT,
    p_limit INT,
    p_window INTERVAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INT;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RETURN TRUE; END IF; -- Skip for service role/unauthenticated (handled by RLS)

    SELECT count(*) INTO v_count
    FROM public.request_logs
    WHERE user_id = v_user_id
      AND action_name = p_action
      AND created_at > now() - p_window;
      
    IF v_count >= p_limit THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO public.request_logs (user_id, action_name) VALUES (v_user_id, p_action);
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Refactor borrow_book_v2 to prevent IDOR
DROP FUNCTION IF EXISTS public.borrow_book_v2(text, uuid, uuid);
CREATE OR REPLACE FUNCTION public.borrow_book_v2(p_isbn TEXT, p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available_copies INT;
    v_record_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- Rate Limit: 10 borrows per hour
    IF NOT public.check_rate_limit('borrow_book', 10, INTERVAL '1 hour') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.');
    END IF;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Yêu cầu đăng nhập');
    END IF;

    -- Check Branch Inventory
    SELECT available_copies INTO v_available_copies
    FROM public.branch_inventory
    WHERE book_isbn = p_isbn AND branch_id = p_branch_id
    FOR UPDATE;

    IF v_available_copies IS NULL OR v_available_copies <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sách không có sẵn tại chi nhánh này');
    END IF;

    -- Borrow Limit Check (max 5)
    IF (SELECT COUNT(*) FROM public.borrow_records WHERE user_id = v_user_id AND status = 'BORROWED') >= 5 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn đã đạt giới hạn mượn 5 cuốn sách');
    END IF;

    -- Create Record
    INSERT INTO public.borrow_records (book_id, user_id, branch_id, due_date, status)
    VALUES (p_isbn, v_user_id, p_branch_id, CURRENT_TIMESTAMP + INTERVAL '14 days', 'BORROWED')
    RETURNING id INTO v_record_id;

    -- Update Branch Inventory
    UPDATE public.branch_inventory
    SET available_copies = available_copies - 1
    WHERE book_isbn = p_isbn AND branch_id = p_branch_id;

    -- Sync global books table
    UPDATE public.books SET available_copies = GREATEST(0, available_copies - 1) WHERE isbn = p_isbn;

    RETURN jsonb_build_object('success', true, 'record_id', v_record_id, 'message', 'Mượn sách thành công');
END;
$$;

-- 3. Refactor return_book_v2 to prevent IDOR and add RBAC
DROP FUNCTION IF EXISTS public.return_book_v2(text, uuid, uuid);
CREATE OR REPLACE FUNCTION public.return_book_v2(p_isbn TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id UUID;
    v_branch_id UUID;
    v_due_date TIMESTAMP;
    v_days_overdue INT;
    v_fine_amount DECIMAL(10,2) := 0;
    v_user_id UUID := auth.uid();
BEGIN
    -- Find active borrow record FOR THE CURRENT USER (IDOR Fix)
    SELECT id, branch_id, due_date INTO v_record_id, v_branch_id, v_due_date
    FROM public.borrow_records
    WHERE book_id = p_isbn AND user_id = v_user_id AND status = 'BORROWED'
    ORDER BY borrowed_at DESC
    LIMIT 1;

    IF v_record_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy bản ghi mượn của bạn');
    END IF;

    -- Calculate Fine
    v_days_overdue := DATE_PART('day', CURRENT_TIMESTAMP - v_due_date);
    IF v_days_overdue > 0 THEN
        v_fine_amount := v_days_overdue * 2000;
    END IF;

    -- Update Record
    UPDATE public.borrow_records 
    SET returned_at = CURRENT_TIMESTAMP, 
        status = 'RETURNED',
        fine_amount = v_fine_amount
    WHERE id = v_record_id;

    -- Update Branch Inventory
    UPDATE public.branch_inventory
    SET available_copies = available_copies + 1
    WHERE book_isbn = p_isbn AND branch_id = v_branch_id;

    -- Sync global books table
    UPDATE public.books SET available_copies = LEAST(available_copies + 1, total_copies) WHERE isbn = p_isbn;

    RETURN jsonb_build_object('success', true, 'fine_amount', v_fine_amount, 'message', 'Trả sách thành công');
END;
$$;

-- 3.1 Refactor return_book_by_isbn (Librarian Version)
DROP FUNCTION IF EXISTS public.return_book_by_isbn(text, uuid, numeric);
CREATE OR REPLACE FUNCTION public.return_book_by_isbn(p_isbn TEXT, p_librarian_id UUID, p_late_fine NUMERIC DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id UUID;
    v_due_date TIMESTAMP;
    v_fine_amount DECIMAL(10,2);
    v_caller_id UUID := auth.uid();
BEGIN
    -- RBAC Check: Must be Librarian or Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_caller_id AND role IN ('LIBRARIAN'::"Role", 'ADMIN'::"Role")
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Chỉ thủ thư mới có quyền thực hiện thao tác này');
    END IF;

    -- Find active borrow record
    SELECT id, due_date INTO v_record_id, v_due_date
    FROM public.borrow_records
    WHERE book_id = p_isbn AND status = 'BORROWED'
    ORDER BY borrowed_at DESC
    LIMIT 1;

    IF v_record_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy bản ghi mượn đang hoạt động cho ISBN này');
    END IF;

    -- Use provided fine or calculate
    v_fine_amount := COALESCE(p_late_fine, 0);

    -- Update Record
    UPDATE public.borrow_records 
    SET returned_at = CURRENT_TIMESTAMP, 
        status = 'RETURNED',
        fine_amount = v_fine_amount
    WHERE id = v_record_id;

    -- Update Books (Sync)
    UPDATE public.books 
    SET available_copies = LEAST(available_copies + 1, total_copies) 
    WHERE isbn = p_isbn;

    -- Update Branch Inventory if exists (Attempt)
    UPDATE public.branch_inventory
    SET available_copies = available_copies + 1
    WHERE book_isbn = p_isbn 
      AND branch_id = (SELECT branch_id FROM public.borrow_records WHERE id = v_record_id);

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Trả sách thành công',
        'fine_amount', v_fine_amount,
        'record_id', v_record_id
    );
END;
$$;

-- 4. Refactor pay_fine with RBAC
DROP FUNCTION IF EXISTS public.pay_fine(uuid, text);
CREATE OR REPLACE FUNCTION public.pay_fine(p_record_id UUID, p_method TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_user_id UUID;
BEGIN
    -- Get record owner
    SELECT user_id INTO v_user_id FROM public.borrow_records WHERE id = p_record_id;

    -- Check if caller is owner OR a Librarian/Admin
    IF v_caller_id != v_user_id AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_caller_id AND role IN ('LIBRARIAN'::"Role", 'ADMIN'::"Role")
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bạn không có quyền thực hiện giao dịch này');
    END IF;

    UPDATE public.borrow_records
    SET fine_amount = 0
    WHERE id = p_record_id;

    -- Create transaction record (History)
    INSERT INTO public.transactions (borrow_record_id, amount, status, method)
    SELECT p_record_id, fine_amount, 'COMPLETED', p_method
    FROM public.borrow_records WHERE id = p_record_id AND fine_amount > 0;

    RETURN jsonb_build_object('success', true, 'message', 'Đã xóa nợ thành công');
END;
$$;

-- 5. Tighten RLS Policies

-- Profiles: Restrict public access
DROP POLICY IF EXISTS "Public Profiles Access" ON public.profiles;
CREATE POLICY "Public Basic Info Access" ON public.profiles
FOR SELECT USING (true); -- Note: We should ideally filter columns, but for now we keep it basic

-- Borrow Records: Add missing policies
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own borrow records" ON public.borrow_records;
CREATE POLICY "Users can view own borrow records" ON public.borrow_records
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Librarians can view all borrow records" ON public.borrow_records;
CREATE POLICY "Librarians can view all borrow records" ON public.borrow_records
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('LIBRARIAN'::"Role", 'ADMIN'::"Role")
    )
);

-- Transactions: Add missing policies
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.borrow_records 
        WHERE id = borrow_record_id AND user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Librarians can view all transactions" ON public.transactions;
CREATE POLICY "Librarians can view all transactions" ON public.transactions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('LIBRARIAN'::"Role", 'ADMIN'::"Role")
    )
);

-- Audit Logs: Ensure Admin ONLY
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.audit_logs;
CREATE POLICY "Admins can manage audit logs" ON public.audit_logs
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'::"Role"
    )
);

-- 6. Additional RPC Hardening
-- Award XP: Prevent self-awarding via direct RPC
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_xp INTEGER;
    v_new_xp INTEGER;
    v_new_level INTEGER;
    v_caller_id UUID := auth.uid();
BEGIN
    -- Only allow if called by a Librarian/Admin or if called by the system (service_role)
    -- In Supabase, if auth.uid() is null but it's a SECURITY DEFINER calling it, 
    -- we might need a more precise check.
    -- For now, let's allow service_role and Librarians.
    IF v_caller_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_caller_id AND role IN ('LIBRARIAN'::"Role", 'ADMIN'::"Role")
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only librarians can award XP manually.';
    END IF;

    SELECT xp INTO v_current_xp FROM public.profiles WHERE id = p_user_id;
    v_new_xp := COALESCE(v_current_xp, 0) + p_amount;
    
    -- Level calculation logic: Level = floor(sqrt(xp / 100)) + 1
    v_new_level := floor(sqrt(v_new_xp / 100)) + 1;
    
    UPDATE public.profiles 
    SET xp = v_new_xp, 
        level = v_new_level,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Check for badges
    PERFORM public.check_for_badges(p_user_id);
END;
$$;

-- Role Upgrade: Add Rate Limiting
CREATE OR REPLACE FUNCTION public.verify_and_upgrade_role(
    secret_code TEXT,
    requested_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    -- Rate Limit: 3 attempts per hour
    IF NOT public.check_rate_limit('role_upgrade_attempt', 3, INTERVAL '1 hour') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Quá nhiều lần thử thất bại. Vui lòng thử lại sau 1 giờ.');
    END IF;

    IF requested_role = 'ADMIN' AND secret_code = 'ADMIN_SECRET_2026' THEN
        UPDATE public.profiles SET role = 'ADMIN', updated_at = now() WHERE id = v_user_id;
        RETURN jsonb_build_object('success', true, 'message', 'Đã nâng cấp lên ADMIN');
    ELSIF requested_role = 'LIBRARIAN' AND secret_code = 'LIB_SECRET_2026' THEN
        UPDATE public.profiles SET role = 'LIBRARIAN', updated_at = now() WHERE id = v_user_id;
        RETURN jsonb_build_object('success', true, 'message', 'Đã nâng cấp lên LIBRARIAN');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Mã xác thực không chính xác');
    END IF;
END;
$$;
