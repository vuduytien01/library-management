/**
 * VoizFM (voiz.vn) Scraper
 * Strategy: Playwright headless browser — intercept XHR API + DOM extraction
 * Rate limit: 1 req / 3 seconds recommended
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { AudiobookMetadata, Chapter } from './types';

const BASE_URL = 'https://voiz.vn';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

function parseIsbn(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/ISBN[:\s]*([\d\-Xx]+)/i);
  return match ? match[1].trim() : null;
}

function parseDurationMinutes(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(phút|min|minutes)/i);
  if (match) return parseInt(match[1]) * 60;
  const hourMatch = text.match(/(\d+)\s*gi[oờ]/i);
  const minMatch = text.match(/(\d+)\s*(phút|min)/i);
  const h = hourMatch ? parseInt(hourMatch[1]) : 0;
  const m = minMatch ? parseInt(minMatch[1]) : 0;
  return (h * 60 + m) * 60 || null;
}

interface ApiBookData {
  id?: number;
  title?: string;
  author?: { name?: string };
  narrator?: { name?: string };
  description?: string;
  image?: string;
  cover?: string;
  duration?: number;
  categories?: Array<{ name?: string }>;
  tags?: Array<{ name?: string }>;
  rating?: number;
  totalRating?: number;
  reviewCount?: number;
  price?: number;
  isFree?: boolean;
  publisher?: string;
  chapters?: Array<{
    id?: number;
    title?: string;
    name?: string;
    duration?: number;
    index?: number;
    order?: number;
  }>;
}

export async function scrapeVoizFMBook(bookId: number): Promise<AudiobookMetadata | null> {
  const url = `${BASE_URL}/play/${bookId}`;
  const bro = await getBrowser();
  const context: BrowserContext = await bro.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    locale: 'vi-VN',
  });
  const page: Page = await context.newPage();

  let apiBookData: ApiBookData | null = null;
  let apiChapters: any[] = [];

  // Intercept API responses
  page.on('response', async (res) => {
    const resUrl = res.url();
    const ct = res.headers()['content-type'] ?? '';
    if (!ct.includes('application/json')) return;

    try {
      // Book detail endpoint patterns: /api/books/{id}, /v1/books/{id}, /play/{id}
      if (
        resUrl.match(/\/(api|v\d)\/(books|audios|audiobooks)\/\d+/i) ||
        resUrl.includes(`/play/${bookId}`)
      ) {
        const json = await res.json();
        const data = json?.data ?? json?.book ?? json?.audiobook ?? json;
        if (data?.id || data?.title) {
          apiBookData = data;
        }
      }

      // Chapter list endpoint
      if (resUrl.match(/chapters|tracks|episodes/i)) {
        const json = await res.json();
        const items = json?.data ?? json?.chapters ?? json?.items ?? [];
        if (Array.isArray(items) && items.length > 0) {
          apiChapters = items;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for key elements
    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => null);

    // --- DOM extraction ---
    const title = await page
      .$eval('h1', (el) => el.textContent?.trim() ?? '')
      .catch(() => '');

    // Try multiple selectors for each field
    const author = await page
      .$eval(
        '[class*="author"], [data-testid="author"], .author-name, a[href*="/author/"]',
        (el) => el.textContent?.trim() ?? ''
      )
      .catch(() => null);

    const narrator = await page
      .$eval(
        '[class*="narrator"], [class*="reader"], [data-testid="narrator"], .narrator-name',
        (el) => el.textContent?.trim() ?? ''
      )
      .catch(() => null);

    const description = await page
      .$eval(
        '[class*="description"], [class*="content"], [data-testid="description"], .book-description',
        (el) => el.textContent?.trim() ?? ''
      )
      .catch(() => null);

    const cover_url = await page
      .$eval(
        'img[class*="cover"], img[class*="thumbnail"], [class*="book-image"] img, img[alt*="cover"]',
        (el) => (el as HTMLImageElement).src
      )
      .catch(
        async () =>
          await page
            .$eval('meta[property="og:image"]', (el) =>
              (el as HTMLMetaElement).content
            )
            .catch(() => null)
      );

    // Duration — look for "X phút" or "X giờ" text
    const durationText = await page
      .$eval('[class*="duration"], [class*="time"]', (el) => el.textContent?.trim() ?? '')
      .catch(() => null);

    // Full page text for ISBN
    const bodyText = await page.$eval('body', (el) => el.innerText).catch(() => '');

    // Chapters from DOM if API didn't capture
    if (apiChapters.length === 0) {
      apiChapters = await page
        .$$eval(
          '[class*="chapter"] [class*="item"], [class*="track"] [class*="item"], [class*="episode"]',
          (items) =>
            items.map((item, i) => ({
              index: i + 1,
              title:
                (item.querySelector('[class*="title"]') as HTMLElement)?.innerText?.trim() ??
                item.textContent?.trim() ??
                '',
              duration:
                (item.querySelector('[class*="duration"], [class*="time"]') as HTMLElement)
                  ?.innerText?.trim() ?? null,
            }))
        )
        .catch(() => []);
    }

    // Categories
    const categories = await page
      .$$eval(
        '[class*="category"] a, [class*="genre"] a, [class*="tag"] a',
        (els) => els.map((el) => el.textContent?.trim() ?? '').filter(Boolean)
      )
      .catch(() => []);

    // Rating
    const ratingText = await page
      .$eval('[class*="rating"] [class*="score"], [class*="star-count"]', (el) =>
        el.textContent?.trim()
      )
      .catch(() => null);

    // Build chapters
    const chapters: Chapter[] = (apiChapters.length > 0 ? apiChapters : []).map((ch: any, i) => {
      let dur: number | null = null;
      if (typeof ch.duration === 'number') dur = ch.duration;
      else if (typeof ch.duration === 'string') dur = parseDurationMinutes(ch.duration);

      return {
        index: ch.index ?? ch.order ?? ch.id ?? i + 1,
        title: ch.title ?? ch.name ?? `Chương ${i + 1}`,
        duration_seconds: dur,
      };
    });

    // Merge API data with DOM data (API takes priority)
    const merged: AudiobookMetadata = {
      source_platform: 'voizfm',
      source_id: String(bookId),
      source_url: url,
      title: apiBookData?.title ?? title,
      author: apiBookData?.author?.name ?? author,
      narrator: apiBookData?.narrator?.name ?? narrator,
      description: apiBookData?.description ?? description,
      publisher: apiBookData?.publisher ?? null,
      isbn: parseIsbn(bodyText),
      language: 'vi',
      cover_url: apiBookData?.cover ?? apiBookData?.image ?? cover_url,
      duration_seconds:
        typeof apiBookData?.duration === 'number'
          ? apiBookData.duration
          : parseDurationMinutes(durationText),
      chapters,
      categories:
        ((apiBookData?.categories ?? []).map((c: any) => c?.name ?? c).filter(Boolean).length > 0
          ? (apiBookData?.categories ?? []).map((c: any) => c?.name ?? c).filter(Boolean)
          : categories),
      tags: (apiBookData?.tags ?? []).map((t: any) => t?.name ?? t).filter(Boolean),
      price: apiBookData?.price ?? null,
      is_free: apiBookData?.isFree ?? false,
      rating: apiBookData?.rating ?? apiBookData?.totalRating ?? (parseFloat(ratingText ?? '') || null),
      review_count: apiBookData?.reviewCount ?? 0,
      published_at: null,
    };

    return merged;
  } catch (err: any) {
    console.error(`[VoizFM] Error scraping book ${bookId}: ${err.message}`);
    return null;
  } finally {
    await context.close();
  }
}

/** Discover all book IDs from VoizFM catalog */
export async function getVoizFMCatalogIds(): Promise<number[]> {
  const bro = await getBrowser();
  const page = await bro.newPage();
  const ids = new Set<number>();

  const categories = [
    '/audio-book',
    '/story-book',
    '/summary-book',
    '/book-children',
  ];

  for (const cat of categories) {
    try {
      await page.goto(`${BASE_URL}${cat}`, { waitUntil: 'networkidle', timeout: 30000 });
      // Scroll down to load more
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(1000);
      }
      // Extract IDs from play links
      const hrefs = await page.$$eval(
        'a[href*="/play/"]',
        (els) => els.map((el) => el.getAttribute('href') ?? '')
      );
      for (const href of hrefs) {
        const m = href.match(/\/play\/(\d+)/);
        if (m) ids.add(parseInt(m[1]));
      }
      console.log(`[VoizFM] ${cat}: found ${ids.size} IDs so far`);
      await page.waitForTimeout(2000);
    } catch (err: any) {
      console.error(`[VoizFM] Error on ${cat}: ${err.message}`);
    }
  }

  await page.close();
  return [...ids].sort((a, b) => a - b);
}

