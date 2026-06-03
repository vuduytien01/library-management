/**
 * Fonos.vn Scraper
 * Strategy: Fetch HTML page → parse __NEXT_DATA__ JSON (no browser needed)
 * Rate limit: 1 req / 2 seconds recommended
 *
 * DATA STRUCTURE (confirmed 2026-04):
 *   __NEXT_DATA__ → props.pageProps.dehydratedState.queries[]
 *   → find query with queryKey containing "book-data" or the slug
 *   → state.data = book object
 *
 * CONFIRMED FIELD NAMES:
 *   title, author.name, voiceActors[].name, isbnNumber,
 *   coverImageUrl, duration (seconds float), price (number),
 *   chapters[].{order, name, duration}, categories[].name,
 *   avgRating, reviewCount, description
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import type { AudiobookMetadata, Chapter } from './types';

const BASE_URL = 'https://fonos.vn';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
};

function parseDurationToSeconds(str: string | undefined): number | null {
  if (!str) return null;
  // "6 giờ 55 phút" or "41 phút" or raw seconds number
  const hoursMatch = str.match(/(\d+)\s*gi[oờ]/i);
  const minsMatch = str.match(/(\d+)\s*(phút|min)/i);
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const mins = minsMatch ? parseInt(minsMatch[1]) : 0;
  return hours * 3600 + mins * 60 || null;
}

function parsePrice(str: string | undefined): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned) : null;
}

/**
 * Extract book data from Fonos __NEXT_DATA__
 * Confirmed: data is at props.pageProps.dehydratedState.queries[].state.data
 */
function extractBookFromNextData(nextData: any, slug: string): any | null {
  // Method 1: dehydratedState.queries (confirmed working as of 2026-04)
  const queries: any[] = nextData?.props?.pageProps?.dehydratedState?.queries ?? [];
  for (const q of queries) {
    const key = JSON.stringify(q.queryKey ?? []);
    if (key.includes('book') || key.includes(slug)) {
      const data = q?.state?.data;
      if (data?.title) return data;
    }
  }
  // Fallback: any query with a book-like data shape
  for (const q of queries) {
    const data = q?.state?.data;
    if (data?.title && data?.isbnNumber) return data;
    if (data?.title && data?.chapters) return data;
  }

  // Method 2: direct pageProps (legacy)
  const pp = nextData?.props?.pageProps;
  for (const key of ['book', 'data', 'bookDetail', 'bookData']) {
    if (pp?.[key]?.title) return pp[key];
  }

  return null;
}

export async function scrapeFonosBook(slug: string): Promise<AudiobookMetadata | null> {
  const url = `${BASE_URL}/sach-noi/${slug}`;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const nextDataRaw = $('#__NEXT_DATA__').text();
    if (!nextDataRaw) {
      console.warn(`[Fonos] No __NEXT_DATA__ found for slug: ${slug}`);
      return scrapeFonosFallback($, slug, url);
    }

    const nextData = JSON.parse(nextDataRaw);
    const book = extractBookFromNextData(nextData, slug);

    if (!book) {
      console.warn(`[Fonos] No book data found for: ${slug}`);
      return scrapeFonosFallback($, slug, url);
    }

    // Chapters — confirmed fields: order, name, duration (seconds)
    const chapters: Chapter[] = (book.chapters ?? book.tracks ?? []).map(
      (ch: any, i: number) => ({
        index: ch.order ?? ch.index ?? i + 1,
        title: ch.name ?? ch.title ?? `Chương ${i + 1}`,
        duration_seconds:
          typeof ch.duration === 'number'
            ? Math.round(ch.duration)
            : parseDurationToSeconds(ch.duration) ?? null,
      })
    );

    // Narrator — Fonos uses 'voiceActors' array
    const voiceActor = book.voiceActors?.[0];
    const narrator =
      (typeof voiceActor === 'string' ? voiceActor : voiceActor?.name) ??
      book.narrator?.name ??
      book.narratorName ??
      null;

    return {
      source_platform: 'fonos',
      source_id: slug,
      source_url: url,
      title: book.title ?? book.name ?? '',
      author:
        book.author?.name ??
        book.authorName ??
        (Array.isArray(book.authors) ? book.authors[0]?.name : null) ??
        null,
      narrator,
      description: book.description ?? book.content ?? null,
      publisher: book.publisher?.name ?? book.publisherName ?? null,
      isbn: book.isbnNumber ?? book.isbn ?? null,
      language: book.language ?? 'vi',
      cover_url: book.coverImageUrl ?? book.coverImage ?? book.image ?? book.thumbnail ?? null,
      duration_seconds:
        typeof book.duration === 'number'
          ? Math.round(book.duration)
          : parseDurationToSeconds(book.duration),
      chapters,
      categories: (book.categories ?? book.genres ?? []).map((c: any) => c.name ?? c).filter(Boolean),
      tags: (book.tags ?? []).map((t: any) => t.name ?? t).filter(Boolean),
      price: typeof book.price === 'number' ? book.price : parsePrice(book.price),
      is_free: book.isFree ?? book.free ?? false,
      rating: book.avgRating ?? book.rating ?? null,
      review_count: book.reviewCount ?? book.totalReview ?? 0,
      published_at: book.publishedAt ?? book.releaseDate ?? null,
    };
  } catch (err: any) {
    console.error(`[Fonos] Error scraping ${url}: ${err.message}`);
    return null;
  }
}

function scrapeFonosFallback(
  $: cheerio.CheerioAPI,
  slug: string,
  url: string
): AudiobookMetadata {
  // HTML fallback for when __NEXT_DATA__ doesn't have the right shape
  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('.book-description, .description').first().text().trim() ||
    null;
  const cover_url =
    $('meta[property="og:image"]').attr('content') ||
    $('img.cover, img.book-cover').first().attr('src') ||
    null;

  return {
    source_platform: 'fonos',
    source_id: slug,
    source_url: url,
    title,
    author: $('.author-name, [class*="author"]').first().text().trim() || null,
    narrator: null,
    description,
    publisher: null,
    isbn: null,
    language: 'vi',
    cover_url,
    duration_seconds: null,
    chapters: [],
    categories: [],
    tags: [],
    price: null,
    is_free: false,
    rating: null,
    review_count: 0,
    published_at: null,
  };
}

/** Get all book slugs from Fonos catalog pages using Playwright */
export async function getFonosCatalogSlugs(maxPages = 5): Promise<string[]> {
  const slugs = new Set<string>();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (let p = 1; p <= maxPages; p++) {
      const url = `${BASE_URL}/sach-noi?page=${p}`;
      console.log(`[Fonos] Discovery: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Wait for at least one book link to appear
      try {
        await page.waitForSelector('a[href*="/sach-noi/"]', { timeout: 5000 });
      } catch (e) {}

      const pageSlugs = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/sach-noi/"]'));
        return links
          .map(a => (a as HTMLAnchorElement).getAttribute('href'))
          .filter(Boolean)
          .map(href => {
            const parts = href!.split('/sach-noi/');
            return parts[1]?.split('/')[0]?.split('?')[0]?.trim();
          })
          .filter(s => s && s.length > 3);
      });

      pageSlugs.forEach(s => slugs.add(s));
      console.log(`[Fonos] Page ${p}: found ${pageSlugs.length} slugs. Total: ${slugs.size}`);

      if (pageSlugs.length === 0) break;
    }
  } catch (err: any) {
    console.error(`[Fonos] Discovery error: ${err.message}`);
  } finally {
    await browser.close();
  }

  return [...slugs];
}

