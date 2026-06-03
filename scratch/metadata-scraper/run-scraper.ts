/**
 * Main runner: scrape both Fonos and VoizFM in bulk with rate limiting
 * Usage:
 *   npx tsx scratch/metadata-scraper/run-scraper.ts fonos <slug>
 *   npx tsx scratch/metadata-scraper/run-scraper.ts voizfm <id>
 *   npx tsx scratch/metadata-scraper/run-scraper.ts fonos-catalog
 *   npx tsx scratch/metadata-scraper/run-scraper.ts voizfm-catalog
 */

import pLimit from 'p-limit';
import { scrapeFonosBook, getFonosCatalogSlugs } from './fonos-scraper';
import { scrapeVoizFMBook, getVoizFMCatalogIds, closeBrowser as closeVoizBrowser } from './voizfm-scraper';
import { scrapeThuVienSachNoiBook, getThuVienSachNoiCatalog, closeBrowser as closeThuVienBrowser } from './thuviensachnoi-scraper';
import { saveMetadata, batchSave, closePool } from './save-to-db';
import type { AudiobookMetadata } from './types';
import fs from 'fs';
import path from 'path';

const RESULTS_DIR = path.join(__dirname, 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function saveJson(filename: string, data: any) {
  const outPath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[Runner] Saved to ${outPath}`);
}

async function runFonosSingle(slug: string) {
  console.log(`\n📚 Fonos single: ${slug}`);
  const data = await scrapeFonosBook(slug);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
    await saveMetadata(data);
    saveJson(`fonos-${slug}.json`, data);
  } else {
    console.error('Failed to scrape');
  }
}

async function runVoizFMSingle(id: number) {
  console.log(`\n🎙️ VoizFM single: ${id}`);
  const data = await scrapeVoizFMBook(id);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
    await saveMetadata(data);
    saveJson(`voizfm-${id}.json`, data);
  } else {
    console.error('Failed to scrape');
  }
  await closeVoizBrowser();
}

async function runThuVienSingle(url: string, migrate = true) {
  console.log(`\n📖 ThuVienSachNoi single: ${url} (Migrate: ${migrate})`);
  const data = await scrapeThuVienSachNoiBook(url, migrate);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
    await saveMetadata(data);
    saveJson(`thuviensachnoi-${data.source_id}.json`, data);
  } else {
    console.error('Failed to scrape');
  }
  await closeThuVienBrowser();
}

async function runFonosCatalog() {
  console.log('\n📚 Fonos catalog crawl...');
  const slugs = await getFonosCatalogSlugs(100);
  console.log(`[TEST MODE] Found ${slugs.length} books. Scraping...`);
  saveJson('fonos-slugs.json', slugs);

  const limit = pLimit(2); // 2 concurrent
  const results: AudiobookMetadata[] = [];

  await Promise.all(
    slugs.map((slug) =>
      limit(async () => {
        const data = await scrapeFonosBook(slug);
        if (data) {
          results.push(data);
          await saveMetadata(data);
        }
        // Rate limit: 2 seconds per request
        await new Promise((r) => setTimeout(r, 2000));
      })
    )
  );

  saveJson('fonos-catalog-results.json', results);
  console.log(`\n✅ Fonos done: ${results.length}/${slugs.length} scraped`);
}

async function runVoizFMCatalog() {
  console.log('\n🎙️ VoizFM catalog crawl...');
  const ids = await getVoizFMCatalogIds();
  console.log(`[TEST MODE] Found ${ids.length} books. Scraping...`);
  saveJson('voizfm-ids.json', ids);

  const limit = pLimit(1); // 1 concurrent (Playwright)
  const results: AudiobookMetadata[] = [];

  await Promise.all(
    ids.map((id) =>
      limit(async () => {
        const data = await scrapeVoizFMBook(id);
        if (data) {
          results.push(data);
          await saveMetadata(data);
        }
        await new Promise((r) => setTimeout(r, 3000));
      })
    )
  );

  await closeVoizBrowser();
  saveJson('voizfm-catalog-results.json', results);
  console.log(`\n✅ VoizFM done: ${results.length}/${ids.length} scraped`);
}

async function runThuVienCatalog(maxPages = 1, migrate = true) {
  console.log(`\n📖 ThuVienSachNoi catalog crawl... (Max Pages: ${maxPages}, Migrate: ${migrate})`);
  const urls = await getThuVienSachNoiCatalog(maxPages);
  console.log(`Found ${urls.length} books. Scraping...`);

  const limit = pLimit(1); // Playwright
  const results: AudiobookMetadata[] = [];

  for (const url of urls) {
    await limit(async () => {
      const data = await scrapeThuVienSachNoiBook(url, migrate);
      if (data) {
        results.push(data);
        await saveMetadata(data);
      }
      await new Promise((r) => setTimeout(r, 2000));
    });
  }

  await closeThuVienBrowser();
  saveJson('thuviensachnoi-catalog-results.json', results);
  console.log(`\n✅ ThuVienSachNoi done: ${results.length}/${urls.length} scraped`);
}

// --- CLI ---
const [, , command, arg] = process.argv;

(async () => {
  switch (command) {
    case 'fonos':
      if (!arg) { console.error('Usage: ... fonos <slug>'); process.exit(1); }
      await runFonosSingle(arg);
      break;
    case 'voizfm':
      if (!arg) { console.error('Usage: ... voizfm <id>'); process.exit(1); }
      await runVoizFMSingle(parseInt(arg));
      break;
    case 'fonos-catalog':
      await runFonosCatalog();
      break;
    case 'voizfm-catalog':
      await runVoizFMCatalog();
      break;
    case 'thuviensachnoi':
      if (!arg) { console.error('Usage: ... thuviensachnoi <url>'); process.exit(1); }
      await runThuVienSingle(arg);
      break;
    case 'thuviensachnoi-catalog':
      await runThuVienCatalog(arg ? parseInt(arg) : 1);
      break;
    case 'catalog':
      await runFonosCatalog();
      await runVoizFMCatalog();
      await runThuVienCatalog(1);
      break;
    default:
      console.log(`Usage:
  npx tsx scratch/metadata-scraper/run-scraper.ts fonos <slug>          # Scrape 1 Fonos book
  npx tsx scratch/metadata-scraper/run-scraper.ts voizfm <id>           # Scrape 1 VoizFM book
  npx tsx scratch/metadata-scraper/run-scraper.ts thuviensachnoi <url>  # Scrape 1 ThuVienSachNoi book
  npx tsx scratch/metadata-scraper/run-scraper.ts fonos-catalog         # Scrape all Fonos books
  npx tsx scratch/metadata-scraper/run-scraper.ts voizfm-catalog        # Scrape all VoizFM books
  npx tsx scratch/metadata-scraper/run-scraper.ts thuviensachnoi-catalog # Scrape all ThuVienSachNoi books
  npx tsx scratch/metadata-scraper/run-scraper.ts catalog               # Scrape EVERYTHING`);
  }
  await closePool();
})();
