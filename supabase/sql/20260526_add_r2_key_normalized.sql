ALTER TABLE public.audiobook_metadata
ADD COLUMN IF NOT EXISTS r2_key_normalized text;

UPDATE public.audiobook_metadata
SET r2_key_normalized = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        COALESCE(
          (
            SELECT replace(tag, 'r2_path:', '')
            FROM unnest(tags) AS tag
            WHERE tag LIKE 'r2_path:%'
            LIMIT 1
          ),
          CASE
            WHEN source_platform = 'r2' THEN source_id
            ELSE NULL
          END
        ),
        '^/+',
        ''
      ),
      '\\+',
      '/',
      'g'
    ),
    '/+',
    '/',
    'g'
  )
)
WHERE r2_key_normalized IS NULL
  AND (
    source_platform = 'r2'
    OR EXISTS (
      SELECT 1
      FROM unnest(tags) AS tag
      WHERE tag LIKE 'r2_path:%'
    )
  );

CREATE INDEX IF NOT EXISTS idx_audiobook_metadata_r2_key_normalized
ON public.audiobook_metadata (r2_key_normalized)
WHERE r2_key_normalized IS NOT NULL;
