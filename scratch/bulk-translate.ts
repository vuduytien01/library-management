import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function translateMetadata(title: string, description: string) {
  const prompt = `
    You are a professional librarian and translator. 
    Translate the following book title and description into both English and Vietnamese.
    
    Original Title: ${title}
    Original Description: ${description}
    
    Return ONLY a JSON object with exactly these keys:
    {
      "title_en": "...",
      "title_vi": "...",
      "description_en": "...",
      "description_vi": "..."
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Translation AI error:', e);
    return {
      title_en: title,
      title_vi: title,
      description_en: description,
      description_vi: description
    };
  }
}

async function bulkTranslate() {
  console.log('Starting bulk translation...');

  // 1. Translate Books
  const { data: books, error: bookError } = await supabase
    .from('books')
    .select('isbn, title, description')
    .or('title_en.is.null,title_vi.is.null');

  if (bookError) {
    console.error('Error fetching books:', bookError);
  } else if (books) {
    console.log(`Found ${books.length} books to translate.`);
    for (const book of books) {
      try {
        console.log(`Translating book: ${book.title}`);
        const trans = await translateMetadata(book.title, book.description || '');
        const { error: updateError } = await supabase
          .from('books')
          .update({
            title_en: trans.title_en,
            title_vi: trans.title_vi,
            description_en: trans.description_en,
            description_vi: trans.description_vi
          })
          .eq('isbn', book.isbn);
        
        if (updateError) console.error(`Failed to update book ${book.isbn}:`, updateError);
      } catch (e) {
        console.error(`Failed to translate book ${book.isbn}:`, e);
      }
    }
  }

  // 2. Translate Audiobooks
  const { data: audiobooks, error: abError } = await supabase
    .from('audiobook_metadata')
    .select('id, title, description')
    .or('title_en.is.null,title_vi.is.null');

  if (abError) {
    console.error('Error fetching audiobooks:', abError);
  } else if (audiobooks) {
    console.log(`Found ${audiobooks.length} audiobooks to translate.`);
    for (const ab of audiobooks) {
      try {
        console.log(`Translating audiobook: ${ab.title}`);
        const trans = await translateMetadata(ab.title, ab.description || '');
        const { error: updateError } = await supabase
          .from('audiobook_metadata')
          .update({
            title_en: trans.title_en,
            title_vi: trans.title_vi,
            description_en: trans.description_en,
            description_vi: trans.description_vi
          })
          .eq('id', ab.id);
        
        if (updateError) console.error(`Failed to update audiobook ${ab.id}:`, updateError);
      } catch (e) {
        console.error(`Failed to translate audiobook ${ab.id}:`, e);
      }
    }
  }

  console.log('Bulk translation completed.');
}

bulkTranslate();
