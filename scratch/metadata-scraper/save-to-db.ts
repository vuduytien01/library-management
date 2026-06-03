/**
 * Save audiobook metadata to Supabase via direct Postgres connection
 * (bypasses RLS entirely — safe for server-side scripts only)
 */

import { Pool } from 'pg';
import type { AudiobookMetadata } from './types';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function saveMetadata(book: AudiobookMetadata): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO audiobook_metadata (
        source_platform, source_id, source_url,
        title, author, narrator, description, publisher, isbn, language,
        cover_url, duration_seconds, chapters,
        categories, tags, price, is_free,
        rating, review_count, published_at, scraped_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
      )
      ON CONFLICT (source_platform, source_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        author = EXCLUDED.author,
        narrator = EXCLUDED.narrator,
        description = EXCLUDED.description,
        publisher = EXCLUDED.publisher,
        isbn = COALESCE(EXCLUDED.isbn, audiobook_metadata.isbn),
        cover_url = COALESCE(EXCLUDED.cover_url, audiobook_metadata.cover_url),
        duration_seconds = COALESCE(EXCLUDED.duration_seconds, audiobook_metadata.duration_seconds),
        chapters = EXCLUDED.chapters,
        categories = EXCLUDED.categories,
        tags = EXCLUDED.tags,
        price = COALESCE(EXCLUDED.price, audiobook_metadata.price),
        is_free = EXCLUDED.is_free,
        rating = COALESCE(EXCLUDED.rating, audiobook_metadata.rating),
        review_count = GREATEST(EXCLUDED.review_count, audiobook_metadata.review_count),
        updated_at = NOW()`,
      [
        book.source_platform,
        book.source_id,
        book.source_url,
        book.title,
        book.author,
        book.narrator,
        book.description,
        book.publisher,
        book.isbn,
        book.language,
        book.cover_url,
        book.duration_seconds,
        JSON.stringify(book.chapters),
        book.categories,
        book.tags,
        book.price,
        book.is_free,
        book.rating,
        book.review_count,
        book.published_at,
      ]
    );
    console.log(`[DB] ✅ Saved "${book.title}" (${book.source_platform}:${book.source_id})`);
    return true;
  } catch (err: any) {
    console.error(`[DB] ❌ Failed to save "${book.title}": ${err.message}`);
    return false;
  } finally {
    client.release();
  }
}

export async function batchSave(books: AudiobookMetadata[]): Promise<void> {
  let success = 0;
  let failed = 0;
  for (const book of books) {
    const ok = await saveMetadata(book);
    if (ok) success++;
    else failed++;
  }
  console.log(`[DB] Batch done: ${success} saved, ${failed} failed`);
  await pool.end();
}

export async function closePool(): Promise<void> {
  await pool.end();
}
