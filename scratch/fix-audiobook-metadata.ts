/**
 * Fix audiobook metadata:
 * 1. Get correct metadata (author, description, ISBN, cover) from Google Books API ("GGLIB")
 * 2. Scrape narrator (giọng đọc / voice read) from thuviensachnoi.vn pages
 * 3. Update cover_url from Google Books for high-quality, reliable covers
 * 4. Write narrator as extra info
 */

import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import * as cheerio from "cheerio";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Step 1: Search Google Books API for correct metadata ─────────────────
async function searchGoogleBooks(title: string, author?: string): Promise<any | null> {
  // Clean title for search - remove Vietnamese audiobook markers
  const cleanTitle = title
    .replace(/\(Audio.*?\)/gi, "")
    .replace(/\(Tiếng.*?\)/gi, "")
    .replace(/\(Full.*?\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .trim();

  // Try multiple search strategies
  const queries = [
    // Strategy 1: Title + Author (most precise)
    author ? `intitle:${cleanTitle}+inauthor:${author}` : null,
    // Strategy 2: Just the title
    `intitle:${cleanTitle}`,
    // Strategy 3: Broader search with title as free text
    cleanTitle,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&langRestrict=vi`;
      console.log(`  [Google Books] Searching: ${query}`);
      const res = await axios.get(url, { timeout: 8000 });
      const items = res.data.items;
      if (!items || items.length === 0) continue;

      // Find best match - prefer Vietnamese results with covers
      for (const item of items) {
        const vi = item.volumeInfo;
        if (!vi) continue;

        // Check title similarity
        const titleLower = cleanTitle.toLowerCase();
        const resultTitle = (vi.title || "").toLowerCase();
        
        // Accept if titles overlap significantly
        const words = titleLower.split(/\s+/).filter((w: string) => w.length > 2);
        const matchCount = words.filter((w: string) => resultTitle.includes(w)).length;
        const matchRatio = words.length > 0 ? matchCount / words.length : 0;

        if (matchRatio >= 0.5 || resultTitle.includes(titleLower) || titleLower.includes(resultTitle)) {
          return vi;
        }
      }

      // Fallback: return first result if exists
      return items[0]?.volumeInfo || null;
    } catch (e: any) {
      console.warn(`  [Google Books] Search failed for "${query}": ${e.message}`);
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  // Try without language restriction
  try {
    const query = `intitle:${cleanTitle}`;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3`;
    const res = await axios.get(url, { timeout: 8000 });
    const items = res.data.items;
    if (items && items.length > 0) {
      return items[0]?.volumeInfo || null;
    }
  } catch (e) {}

  return null;
}

// ── Step 2: Get high-res cover from Google Books ─────────────────────────
function getGoogleBooksCover(volumeInfo: any): string | null {
  if (!volumeInfo?.imageLinks) return null;
  
  // Prefer largest available
  const url = volumeInfo.imageLinks.extraLarge
    || volumeInfo.imageLinks.large
    || volumeInfo.imageLinks.medium
    || volumeInfo.imageLinks.thumbnail
    || volumeInfo.imageLinks.smallThumbnail;

  if (!url) return null;

  // Upgrade to high-res: zoom=0, HTTPS, remove edge=curl
  let upgraded = url
    .replace("http://", "https://")
    .replace(/&edge=curl/g, "")
    .replace(/&imgtk=[A-Za-z0-9_-]+/g, "");

  if (upgraded.includes("zoom=")) {
    upgraded = upgraded.replace(/zoom=\d+/g, "zoom=0");
  } else {
    upgraded += `${upgraded.includes("?") ? "&" : "?"}zoom=0`;
  }

  if (!upgraded.includes("printsec")) {
    upgraded += "&printsec=frontcover";
  }

  return upgraded;
}

// ── Step 3: Get ISBN from Google Books ────────────────────────────────────
function getISBN(volumeInfo: any): string | null {
  if (!volumeInfo?.industryIdentifiers) return null;
  const isbn13 = volumeInfo.industryIdentifiers.find((i: any) => i.type === "ISBN_13");
  const isbn10 = volumeInfo.industryIdentifiers.find((i: any) => i.type === "ISBN_10");
  return isbn13?.identifier || isbn10?.identifier || null;
}

// ── Step 4: Scrape narrator from thuviensachnoi.vn ───────────────────────
async function scrapeNarratorFromThuVienSachNoi(sourceId: string): Promise<string | null> {
  // Try multiple URL patterns that thuviensachnoi uses
  const urlPatterns = [
    `https://thuviensachnoi.vn/${sourceId}.html`,
    `https://thuviensachnoi.vn/sach-noi/${sourceId}.html`,
    `https://thuviensachnoi.vn/${sourceId}`,
  ];

  for (const url of urlPatterns) {
    try {
      console.log(`  [TVSN] Trying: ${url}`);
      const res = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        maxRedirects: 3,
      });

      if (res.status !== 200) continue;

      const $ = cheerio.load(res.data);

      // Pattern 1: Look for "Giọng đọc" label with link
      let narrator: string | null = null;
      
      // The site has: <b>Giọng đọc :</b> <a href="/giong-doc/...">Name</a>
      $('a[href*="/giong-doc/"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 0) {
          narrator = text;
        }
      });

      if (narrator) {
        console.log(`  [TVSN] ✅ Found narrator: ${narrator}`);
        return narrator;
      }

      // Pattern 2: Look for text containing "Giọng đọc"
      const bodyText = $('body').text();
      const match = bodyText.match(/Giọng đọc\s*:\s*([^\n,]+)/i);
      if (match) {
        narrator = match[1].trim();
        if (narrator) {
          console.log(`  [TVSN] ✅ Found narrator (text match): ${narrator}`);
          return narrator;
        }
      }

      console.log(`  [TVSN] ⚠️ Page loaded but no narrator found`);
      return null;
    } catch (e: any) {
      if (e.response?.status === 404) continue;
      console.warn(`  [TVSN] ❌ ${url}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  return null;
}

// ── Step 5: Also try searching thuviensachnoi by title ───────────────────
async function searchThuVienSachNoi(title: string): Promise<{ narrator: string | null; pageUrl: string | null }> {
  try {
    const searchUrl = `https://thuviensachnoi.vn/search/ajax-home.php?keyword=${encodeURIComponent(title)}`;
    console.log(`  [TVSN Search] Searching: ${title}`);
    const res = await axios.get(searchUrl, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const $ = cheerio.load(res.data);
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('.html')) {
        links.push(href.startsWith('http') ? href : `https://thuviensachnoi.vn${href}`);
      }
    });

    if (links.length === 0) return { narrator: null, pageUrl: null };

    // Try the first link
    const pageUrl = links[0];
    console.log(`  [TVSN Search] Found page: ${pageUrl}`);

    const pageRes = await axios.get(pageUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const $page = cheerio.load(pageRes.data);
    let narrator: string | null = null;

    $page('a[href*="/giong-doc/"]').each((_, el) => {
      const text = $page(el).text().trim();
      if (text) narrator = text;
    });

    // Also try "tác giả" link which on thuviensachnoi is sometimes the narrator
    if (!narrator) {
      $page('a[href*="/tac-gia/"]').each((_, el) => {
        const text = $page(el).text().trim();
        if (text) narrator = text;
      });
    }

    return { narrator, pageUrl };
  } catch (e: any) {
    console.warn(`  [TVSN Search] Failed: ${e.message}`);
    return { narrator: null, pageUrl: null };
  }
}

// ── Step 6: Also try OpenLibrary for cover ────────────────────────────────
async function getOpenLibraryCover(title: string, author: string): Promise<string | null> {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`;
    const res = await axios.get(url, { timeout: 5000 });
    const doc = res.data.docs?.[0];
    if (doc?.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    if (doc?.isbn?.[0]) {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }
  } catch (e) {}
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
async function run() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  FIX AUDIOBOOK METADATA FROM GOOGLE BOOKS + NARRATOR");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Fetch all audiobooks
  const { data: audiobooks, error } = await supabase
    .from("audiobook_metadata")
    .select("*");

  if (error || !audiobooks) {
    console.error("Failed to fetch audiobooks:", error);
    return;
  }

  console.log(`Found ${audiobooks.length} audiobooks to fix.\n`);

  const results: any[] = [];

  for (const ab of audiobooks) {
    console.log(`\n━━━ Processing: "${ab.title}" ━━━`);
    console.log(`  Current author: ${ab.author}`);
    console.log(`  Current narrator: ${ab.narrator || "(empty)"}`);
    console.log(`  Current cover: ${ab.cover_url}`);
    console.log(`  Current ISBN: ${ab.isbn || "(none)"}`);

    // ─── Get Google Books metadata ───
    console.log("\n  📚 Searching Google Books...");
    const gbMeta = await searchGoogleBooks(ab.title, ab.author);

    let newAuthor = ab.author;
    let newDescription = ab.description;
    let newCoverUrl = ab.cover_url;
    let newISBN = ab.isbn;
    let newPublisher = ab.publisher;
    let newCategories = ab.categories;

    if (gbMeta) {
      console.log(`  [Google Books] ✅ Found: "${gbMeta.title}" by ${gbMeta.authors?.join(", ")}`);

      // Author - prefer Google Books author (correct book author)
      const gbAuthor = gbMeta.authors?.join(", ");
      if (gbAuthor) {
        newAuthor = gbAuthor;
        console.log(`  → Author: ${newAuthor}`);
      }

      // Description
      if (gbMeta.description && (!newDescription || newDescription.length < gbMeta.description.length)) {
        newDescription = gbMeta.description;
        console.log(`  → Description: ${newDescription.substring(0, 80)}...`);
      }

      // ISBN
      const gbISBN = getISBN(gbMeta);
      if (gbISBN) {
        newISBN = gbISBN;
        console.log(`  → ISBN: ${newISBN}`);
      }

      // Publisher
      if (gbMeta.publisher) {
        newPublisher = gbMeta.publisher;
        console.log(`  → Publisher: ${newPublisher}`);
      }

      // Categories
      if (gbMeta.categories && gbMeta.categories.length > 0) {
        newCategories = gbMeta.categories;
        console.log(`  → Categories: ${newCategories}`);
      }

      // Cover - use Google Books cover (reliable, high-quality)
      const gbCover = getGoogleBooksCover(gbMeta);
      if (gbCover) {
        newCoverUrl = gbCover;
        console.log(`  → Cover: ${newCoverUrl}`);
      }
    } else {
      console.log("  [Google Books] ⚠️ No results found");
      
      // Try OpenLibrary as fallback for cover
      const olCover = await getOpenLibraryCover(ab.title, ab.author || "");
      if (olCover && !newCoverUrl) {
        newCoverUrl = olCover;
        console.log(`  → Cover (OpenLibrary): ${newCoverUrl}`);
      }
    }

    // ─── Get narrator from thuviensachnoi ───
    console.log("\n  🎙️ Searching for narrator (giọng đọc)...");
    let newNarrator = ab.narrator || null;

    if (!newNarrator || newNarrator === "") {
      // Try by source_id first
      if (ab.source_id) {
        newNarrator = await scrapeNarratorFromThuVienSachNoi(ab.source_id);
      }

      // Try by title search
      if (!newNarrator) {
        const searchResult = await searchThuVienSachNoi(ab.title);
        if (searchResult.narrator) {
          newNarrator = searchResult.narrator;
        }
      }
    }

    if (newNarrator) {
      console.log(`  → Narrator (giọng đọc): ${newNarrator}`);
    } else {
      console.log("  → Narrator: ⚠️ Not found");
    }

    // ─── Build update payload ───
    const updatePayload: any = {};
    let changed = false;

    if (newAuthor !== ab.author) { updatePayload.author = newAuthor; changed = true; }
    if (newDescription !== ab.description) { updatePayload.description = newDescription; changed = true; }
    if (newCoverUrl !== ab.cover_url) { updatePayload.cover_url = newCoverUrl; changed = true; }
    if (newISBN !== ab.isbn) { updatePayload.isbn = newISBN; changed = true; }
    if (newPublisher !== ab.publisher) { updatePayload.publisher = newPublisher; changed = true; }
    if (newNarrator && newNarrator !== ab.narrator) { updatePayload.narrator = newNarrator; changed = true; }
    if (JSON.stringify(newCategories) !== JSON.stringify(ab.categories)) { updatePayload.categories = newCategories; changed = true; }

    if (changed) {
      updatePayload.updated_at = new Date().toISOString();

      console.log(`\n  📝 Updating DB...`);
      console.log(`  Changes: ${JSON.stringify(updatePayload, null, 2)}`);

      const { error: updateError } = await supabase
        .from("audiobook_metadata")
        .update(updatePayload)
        .eq("id", ab.id);

      if (updateError) {
        console.error(`  ❌ DB update failed:`, updateError.message);
      } else {
        console.log(`  ✅ Updated successfully!`);
      }
    } else {
      console.log(`\n  ℹ️ No changes needed.`);
    }

    results.push({
      title: ab.title,
      oldAuthor: ab.author,
      newAuthor,
      oldNarrator: ab.narrator,
      newNarrator: newNarrator || "(not found)",
      oldCover: ab.cover_url,
      newCover: newCoverUrl,
      oldISBN: ab.isbn,
      newISBN,
      changed,
    });

    // Rate limit between books
    await new Promise(r => setTimeout(r, 1500));
  }

  // ─── Summary ───
  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════\n");

  for (const r of results) {
    console.log(`📕 ${r.title}`);
    console.log(`   Author: ${r.oldAuthor} → ${r.newAuthor}`);
    console.log(`   Narrator: ${r.oldNarrator || "(empty)"} → ${r.newNarrator}`);
    console.log(`   ISBN: ${r.oldISBN || "(none)"} → ${r.newISBN || "(none)"}`);
    console.log(`   Cover changed: ${r.oldCover !== r.newCover ? "YES" : "no"}`);
    console.log(`   Updated: ${r.changed ? "✅" : "⏭️ skipped"}\n`);
  }
}

run().catch(console.error);
