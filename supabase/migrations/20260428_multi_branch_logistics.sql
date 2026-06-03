-- 2026-04-28: Multi-Branch Logistics Infrastructure

-- 1. Create inventory_transfers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_isbn TEXT NOT NULL REFERENCES public.books(isbn),
    from_branch_id UUID NOT NULL REFERENCES public.branches(id),
    to_branch_id UUID NOT NULL REFERENCES public.branches(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SHIPPING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Create Heatmap View for Demand Analysis
CREATE OR REPLACE VIEW public.branch_borrow_heatmap AS
SELECT 
    branch_id,
    book_id as book_isbn,
    COUNT(*) as borrow_count,
    MAX(borrowed_at) as last_borrowed_at
FROM public.borrow_records
WHERE borrowed_at > now() - INTERVAL '30 days'
GROUP BY branch_id, book_id;

-- 3. RPC: transfer_inventory
CREATE OR REPLACE FUNCTION public.transfer_inventory(
    p_book_isbn TEXT,
    p_from_branch_id UUID,
    p_to_branch_id UUID,
    p_qty INTEGER,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_available INT;
    v_transfer_id UUID;
BEGIN
    -- 1. Check source availability
    SELECT available_copies INTO v_available
    FROM public.branch_inventory
    WHERE book_isbn = p_book_isbn AND branch_id = p_from_branch_id
    FOR UPDATE;

    IF v_available IS NULL OR v_available < p_qty THEN
        RETURN jsonb_build_object('success', false, 'message', 'Số lượng sách khả dụng tại chi nhánh nguồn không đủ.');
    END IF;

    -- 2. Create transfer record
    INSERT INTO public.inventory_transfers (book_isbn, from_branch_id, to_branch_id, quantity, status, created_by)
    VALUES (p_book_isbn, p_from_branch_id, p_to_branch_id, p_qty, 'PENDING', p_user_id)
    RETURNING id INTO v_transfer_id;

    -- 3. Deduct from source
    UPDATE public.branch_inventory
    SET available_copies = available_copies - p_qty,
        total_copies = total_copies - p_qty
    WHERE book_isbn = p_book_isbn AND branch_id = p_from_branch_id;

    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id, 'message', 'Đã khởi tạo lệnh điều chuyển.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: complete_transfer
CREATE OR REPLACE FUNCTION public.complete_transfer(
    p_transfer_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_isbn TEXT;
    v_to_branch UUID;
    v_qty INTEGER;
    v_status TEXT;
BEGIN
    SELECT book_isbn, to_branch_id, quantity, status 
    INTO v_isbn, v_to_branch, v_qty, v_status
    FROM public.inventory_transfers
    WHERE id = p_transfer_id;

    IF v_status != 'SHIPPING' AND v_status != 'PENDING' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Trạng thái lệnh không hợp lệ để hoàn tất.');
    END IF;

    -- Update destination inventory (Upsert)
    INSERT INTO public.branch_inventory (book_isbn, branch_id, available_copies, total_copies)
    VALUES (v_isbn, v_to_branch, v_qty, v_qty)
    ON CONFLICT (book_isbn, branch_id) 
    DO UPDATE SET 
        available_copies = public.branch_inventory.available_copies + v_qty,
        total_copies = public.branch_inventory.total_copies + v_qty;

    -- Update transfer status
    UPDATE public.inventory_transfers
    SET status = 'COMPLETED', updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã nhập kho thành công tại chi nhánh đích.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
