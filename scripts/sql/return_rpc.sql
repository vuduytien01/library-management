-- Function to increment book copies on return
CREATE OR REPLACE FUNCTION increment_book_copies(p_book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE books
    SET available_copies = LEAST(available_copies + 1, total_copies)
    WHERE id = p_book_id;
END;
$$;
