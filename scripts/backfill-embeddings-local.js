const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

// Fix environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; 
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = "gemini-embedding-001";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backfill() {
  console.log('Starting local backfill via Supabase JS...');
  console.log('URL:', SUPABASE_URL);

  while (true) {
    const { data: books, error } = await supabase
      .from('books')
      .select('isbn, title, author, category, description')
      .is('embedding', null)
      .limit(20);

    if (error) {
      console.error('Fetch error:', error);
      break;
    }

    if (!books || books.length === 0) {
      console.log('Done!');
      break;
    }

    console.log(`Processing ${books.length} books...`);

    const requests = books.map(b => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text: `${b.title} ${b.author||''} ${b.category||''} ${b.description||''}`.trim().substring(0, 5000) }] },
      outputDimensionality: 768
    }));

    try {
      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents?key=${GEMINI_KEY}`,
        { requests }
      );

      const embeddings = geminiRes.data.embeddings;
      
      for (let i = 0; i < books.length; i++) {
        if (embeddings[i] && embeddings[i].values) {
          const { error: uErr } = await supabase
            .from('books')
            .update({ embedding: embeddings[i].values })
            .eq('isbn', books[i].isbn);
          
          if (uErr) console.error(`Update error for ${books[i].isbn}:`, uErr);
        }
      }
      console.log(`Batch processed.`);
    } catch (e) {
      console.error('Gemini/Update error:', e.response?.data || e.message);
      break;
    }
  }
}

backfill();
