import { chromium, Browser, Page } from 'playwright';
import type { AudiobookMetadata, Chapter } from './types';
import { migrateToR2 } from './r2-utils';
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://thuviensachnoi.vn';

let browser: Browser | null = null;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Scrape a single book page from thuviensachnoi.vn
 * @param url The full URL of the book page
 * @param migrate Should we migrate the audio to R2?
 */
export async function scrapeThuVienSachNoiBook(url: string, migrate: boolean = true): Promise<AudiobookMetadata | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    console.log(`[ThuVienSachNoi] Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Extract basic metadata
    await page.waitForSelector('h1', { timeout: 10000 });
    const title = await page.textContent('h1').then(t => t?.trim() || '');
    // NOTE: On thuviensachnoi.vn, the link 'a[href^="/tac-gia/"]' is actually
    // the NARRATOR (giọng đọc), NOT the book's author.
    // The real author will be enriched from the books table (NLV source).
    const narratorName = await page.textContent('a[href^="/tac-gia/"]').then(t => t?.trim() || null);
    const cover_url = await page.getAttribute('a[title*="Ảnh bìa"] img', 'src');
    
    // Get audio URL
    // The audio element might take a second to load or have its src set
    await page.waitForSelector('audio', { timeout: 15000 });
    const audioUrl = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? (audio.currentSrc || audio.src) : null;
    });

    if (!audioUrl) {
      console.warn(`[ThuVienSachNoi] No audio URL found for: ${title}`);
    }

    let r2Path = null;
    if (migrate && audioUrl) {
      const extension = audioUrl.split('.').pop()?.split('?')[0] || 'mp3';
      const cleanTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').toLowerCase();
      const filename = `${cleanTitle}.${extension}`;
      
      r2Path = await migrateToR2(audioUrl, filename);
    }

    const metadata: AudiobookMetadata = {
      source_platform: 'thuviensachnoi',
      source_id: url.split('/').filter(Boolean).pop()?.replace('.html', '') || '',
      source_url: url,
      title,
      author: null,           // Will be enriched from books table (NLV metadata)
      narrator: narratorName,  // This is what thuviensachnoi calls "tác giả" but is actually giọng đọc
      description: null, 
      publisher: 'Thư Viện Sách Nói',
      isbn: null,
      language: 'vi',
      cover_url,
      duration_seconds: null,
      chapters: [],
      categories: [],
      tags: [],
      price: 0,
      is_free: true,
      rating: null,
      review_count: 0,
      published_at: new Date().toISOString(),
    };

    if (r2Path) {
      metadata.tags.push(`r2_path:${r2Path}`);
    }

    return metadata;
  } catch (err: any) {
    console.error(`[ThuVienSachNoi] Error scraping ${url}: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Discovery: get book URLs from the catalog
 */
export async function getThuVienSachNoiCatalog(maxPages = 1): Promise<string[]> {
  const urls = new Set<string>();
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    for (let p = 1; p <= maxPages; p++) {
      const url = `${BASE_URL}/sach-noi/page/${p}/`;
      console.log(`[ThuVienSachNoi] Discovery: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const pageUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.block_product_content a.woocommerce-LoopProduct-link'));
        return links.map(a => (a as HTMLAnchorElement).href).filter(Boolean);
      });

      pageUrls.forEach(u => urls.add(u));
      console.log(`[ThuVienSachNoi] Page ${p}: found ${pageUrls.length} books. Total: ${urls.size}`);
      
      if (pageUrls.length === 0) break;
    }
  } catch (err: any) {
    console.error(`[ThuVienSachNoi] Discovery error: ${err.message}`);
  } finally {
    await page.close();
  }

  return [...urls];
}
