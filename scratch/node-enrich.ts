import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function normalizeTitle(title: string): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^a-zA-ZÀ-ỹ0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchExternal(title: string, author: string, titleEn?: string) {
  const cleanTitle = titleEn || normalizeTitle(title);
  const cleanAuthor = author ? normalizeTitle(author) : "";

  let openLibCover = null;
  let googleMetadata: any = null;

  try {
    const olSearchRes = await axios.get(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}&limit=1`,
      { timeout: 5000 },
    );
    const doc = olSearchRes.data.docs?.[0];
    if (doc?.cover_i) {
      openLibCover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    } else if (doc?.isbn?.[0]) {
      openLibCover = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }
    
    if (!openLibCover && titleEn && titleEn !== title) {
      const olSearchResVi = await axios.get(
        `https://openlibrary.org/search.json?title=${encodeURIComponent(normalizeTitle(title))}&limit=1`,
        { timeout: 5000 },
      );
      const docVi = olSearchResVi.data.docs?.[0];
      if (docVi?.cover_i) {
        openLibCover = `https://covers.openlibrary.org/b/id/${docVi.cover_i}-L.jpg`;
      }
    }
  } catch (e) { }

  try {
    const query = titleEn ? `intitle:${titleEn} OR intitle:${title}` : `intitle:${title}`;
    const gRes = await axios.get(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}+inauthor:${encodeURIComponent(cleanAuthor)}&maxResults=1`,
      { timeout: 5000 },
    );
    googleMetadata = gRes.data.items?.[0]?.volumeInfo;
  } catch (e) { }

  return {
    description: googleMetadata?.description,
    thumbnail: openLibCover || googleMetadata?.imageLinks?.thumbnail || googleMetadata?.imageLinks?.smallThumbnail,
  };
}

async function run() {
  const { data: audiobooks } = await supabase.from('audiobook_metadata').select('*');
  if (!audiobooks) return;

  for (const ab of audiobooks) {
    console.log(`Checking ${ab.title}... Cover: ${ab.cover_url}`);
    // Force update for all covers or if they use Amazon images which might be broken
    if (true) {
      console.log(`Fetching external data for ${ab.title}...`);
      
      let matchedIsbn = ab.isbn;
      if (!matchedIsbn) {
        const { data: matchedBooks } = await supabase
          .from("books")
          .select("isbn, cover_url")
          .ilike("title", `%${normalizeTitle(ab.title)}%`)
          .limit(1);
        if (matchedBooks && matchedBooks.length > 0) {
          matchedIsbn = matchedBooks[0].isbn;
          if (!ab.cover_url) ab.cover_url = matchedBooks[0].cover_url;
        }
      }

      const external = await fetchExternal(ab.title, ab.author || "", ab.title_en);
      
      const payload: any = {};
      if (matchedIsbn) payload.isbn = matchedIsbn;
      if (external.thumbnail) payload.cover_url = external.thumbnail;
      if (external.description) payload.description = external.description;

      if (Object.keys(payload).length > 0) {
        console.log(`Updating ${ab.title}...`, payload);
        await supabase.from('audiobook_metadata').update(payload).eq('id', ab.id);
      }
    }
  }
}

run().catch(console.error);
