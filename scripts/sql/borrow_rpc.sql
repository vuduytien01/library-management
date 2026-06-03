-- Transactional function to handle book borrowing
CREATE OR REPLACE FUNCTION borrow_book(p_book_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available_copies INT;
    v_record_id UUID;
BEGIN
    -- 1. Check book availability and LOCK row
    SELECT available_copies INTO v_available_copies
    FROM books
    WHERE id = p_book_id
    FOR UPDATE;

    IF v_available_copies IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Book not found');
    END IF;

    IF v_available_copies <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No copies available');
    END IF;

    -- 2. Create the borrow record (Default 14 days)
    INSERT INTO borrow_records (book_id, user_id, due_date, status)
    VALUES (p_book_id, p_user_id, CURRENT_TIMESTAMP + INTERVAL '14 days', 'BORROWED')
    RETURNING id INTO v_record_id;

    -- 3. Decrement available copies
    UPDATE books
    SET available_copies = available_copies - 1
    WHERE id = p_book_id;

    RETURN jsonb_build_object(
        'success', true, 
        'record_id', v_record_id, 
        'message', 'Book borrowed successfully'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
