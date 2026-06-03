CREATE OR REPLACE FUNCTION public.import_r2_audiobook(
  p_path text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.audiobook_metadata
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_super_admin boolean := false;
  v_source_id text;
  v_source_url text;
  v_title text;
  v_author text;
  v_narrator text;
  v_description text;
  v_categories text[];
  v_tags text[];
  v_record public.audiobook_metadata;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT profiles.is_super_admin
  INTO v_is_super_admin
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  IF COALESCE(v_is_super_admin, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden: Super Admin only';
  END IF;

  v_source_id := COALESCE(NULLIF(p_payload->>'source_id', ''), p_path);
  IF COALESCE(NULLIF(v_source_id, ''), '') = '' THEN
    RAISE EXCEPTION 'R2 path is required';
  END IF;

  v_source_url := COALESCE(
    NULLIF(p_payload->>'source_url', ''),
    'https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev/' ||
      array_to_string(
        ARRAY(
          SELECT replace(replace(replace(part, '%', '%25'), ' ', '%20'), '#', '%23')
          FROM unnest(string_to_array(v_source_id, '/')) AS part
        ),
        '/'
      )
  );
  v_title := COALESCE(
    NULLIF(p_payload->>'title', ''),
    NULLIF(p_payload->>'title_vi', ''),
    regexp_replace(split_part(v_source_id, '/', greatest(array_length(string_to_array(v_source_id, '/'), 1), 1)), '\.[^.]+$', '')
  );
  v_author := COALESCE(
    NULLIF(p_payload->>'author', ''),
    NULLIF(p_payload->>'author_vi', ''),
    NULLIF(p_payload->>'author_en', '')
  );
  v_narrator := COALESCE(
    NULLIF(p_payload->>'narrator', ''),
    NULLIF(p_payload->>'narrator_vi', ''),
    NULLIF(p_payload->>'narrator_en', '')
  );
  v_description := COALESCE(
    NULLIF(p_payload->>'description', ''),
    NULLIF(p_payload->>'description_vi', ''),
    NULLIF(p_payload->>'description_en', '')
  );

  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO v_categories
  FROM jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(p_payload->'categories') = 'array'
        THEN p_payload->'categories'
      ELSE '[]'::jsonb
    END
  ) AS value;

  SELECT ARRAY(
    SELECT DISTINCT value
    FROM (
      SELECT 'r2_path:' || v_source_id AS value
      UNION ALL
      SELECT jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(p_payload->'tags') = 'array'
            THEN p_payload->'tags'
          ELSE '[]'::jsonb
        END
      )
    ) AS tag_values
    WHERE COALESCE(NULLIF(value, ''), '') <> ''
  )
  INTO v_tags;

  INSERT INTO public.audiobook_metadata (
    source_platform,
    source_id,
    source_url,
    r2_key_normalized,
    title,
    title_vi,
    title_en,
    author,
    author_vi,
    author_en,
    narrator,
    narrator_vi,
    narrator_en,
    description,
    description_vi,
    description_en,
    publisher,
    isbn,
    language,
    cover_url,
    duration_seconds,
    categories,
    tags,
    is_free,
    published_at,
    scraped_at,
    updated_at
  )
  VALUES (
    'r2',
    v_source_id,
    v_source_url,
    lower(regexp_replace(replace(v_source_id, '\', '/'), '/+', '/', 'g')),
    v_title,
    COALESCE(NULLIF(p_payload->>'title_vi', ''), v_title),
    NULLIF(p_payload->>'title_en', ''),
    v_author,
    COALESCE(NULLIF(p_payload->>'author_vi', ''), v_author),
    COALESCE(NULLIF(p_payload->>'author_en', ''), v_author),
    v_narrator,
    COALESCE(NULLIF(p_payload->>'narrator_vi', ''), v_narrator),
    COALESCE(NULLIF(p_payload->>'narrator_en', ''), v_narrator),
    v_description,
    COALESCE(NULLIF(p_payload->>'description_vi', ''), v_description),
    NULLIF(p_payload->>'description_en', ''),
    NULLIF(p_payload->>'publisher', ''),
    NULLIF(p_payload->>'isbn', ''),
    COALESCE(NULLIF(p_payload->>'language', ''), 'vi'),
    NULLIF(COALESCE(p_payload->>'cover_url', p_payload->>'thumbnail'), ''),
    NULLIF(p_payload->>'duration_seconds', '')::integer,
    v_categories,
    v_tags,
    COALESCE((p_payload->>'is_free')::boolean, true),
    NULLIF(p_payload->>'published_at', '')::date,
    now(),
    now()
  )
  ON CONFLICT (source_platform, source_id)
  DO UPDATE SET
    source_url = EXCLUDED.source_url,
    r2_key_normalized = EXCLUDED.r2_key_normalized,
    title = EXCLUDED.title,
    title_vi = COALESCE(EXCLUDED.title_vi, public.audiobook_metadata.title_vi),
    title_en = COALESCE(EXCLUDED.title_en, public.audiobook_metadata.title_en),
    author = COALESCE(EXCLUDED.author, public.audiobook_metadata.author),
    author_vi = COALESCE(EXCLUDED.author_vi, public.audiobook_metadata.author_vi),
    author_en = COALESCE(EXCLUDED.author_en, public.audiobook_metadata.author_en),
    narrator = COALESCE(EXCLUDED.narrator, public.audiobook_metadata.narrator),
    narrator_vi = COALESCE(EXCLUDED.narrator_vi, public.audiobook_metadata.narrator_vi),
    narrator_en = COALESCE(EXCLUDED.narrator_en, public.audiobook_metadata.narrator_en),
    description = COALESCE(EXCLUDED.description, public.audiobook_metadata.description),
    description_vi = COALESCE(EXCLUDED.description_vi, public.audiobook_metadata.description_vi),
    description_en = COALESCE(EXCLUDED.description_en, public.audiobook_metadata.description_en),
    cover_url = COALESCE(EXCLUDED.cover_url, public.audiobook_metadata.cover_url),
    duration_seconds = COALESCE(EXCLUDED.duration_seconds, public.audiobook_metadata.duration_seconds),
    categories = CASE
      WHEN array_length(EXCLUDED.categories, 1) IS NULL THEN public.audiobook_metadata.categories
      ELSE EXCLUDED.categories
    END,
    tags = EXCLUDED.tags,
    is_free = EXCLUDED.is_free,
    updated_at = now()
  RETURNING *
  INTO v_record;

  RETURN v_record;
END;
$$;

REVOKE ALL ON FUNCTION public.import_r2_audiobook(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.import_r2_audiobook(text, jsonb) TO authenticated;
