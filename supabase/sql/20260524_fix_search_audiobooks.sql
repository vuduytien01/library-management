CREATE OR REPLACE FUNCTION public.search_audiobooks(query text, lim integer DEFAULT 20)
RETURNS SETOF public.audiobook_metadata
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.audiobook_metadata
    WHERE
        title ILIKE '%' || query || '%' OR
        title_vi ILIKE '%' || query || '%' OR
        title_en ILIKE '%' || query || '%' OR
        author ILIKE '%' || query || '%' OR
        isbn = query
    ORDER BY scraped_at DESC NULLS LAST, title ASC
    LIMIT lim;
END;
$$;
