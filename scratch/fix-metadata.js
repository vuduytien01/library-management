const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');

async function run() {
  console.log('Fetching audiobooks missing english title...');
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, title, description, author, narrator 
      FROM audiobook_metadata 
      WHERE title_en IS NULL OR title_vi IS NULL
    `);
    
    console.log(`Found ${res.rows.length} audiobooks to translate.`);
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    for (const book of res.rows) {
      console.log(`Translating: ${book.title}...`);
      const prompt = `Translate the following book/audiobook metadata into both English and Vietnamese. Return exactly in JSON format without markdown code fences:
      {
        "title_en": "...",
        "title_vi": "...",
        "description_en": "...",
        "description_vi": "...",
        "author_en": "...",
        "author_vi": "...",
        "narrator_en": "...",
        "narrator_vi": "..."
      }
      
      Input:
      - Title: "${book.title}"
      - Description: "${book.description || ''}"
      ${book.author ? `- Author: "${book.author}"` : ""}
      ${book.narrator ? `- Narrator: "${book.narrator}"` : ""}`;

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/\`\`\`json|\`\`\`/g, '').trim();
        const trans = JSON.parse(text);
        
        await client.query(`
          UPDATE audiobook_metadata 
          SET 
            title_en = $1, title_vi = $2,
            description_en = $3, description_vi = $4,
            author_en = $5, author_vi = $6,
            narrator_en = $7, narrator_vi = $8,
            updated_at = NOW()
          WHERE id = $9
        `, [
          trans.title_en, trans.title_vi,
          trans.description_en, trans.description_vi,
          trans.author_en, trans.author_vi,
          trans.narrator_en, trans.narrator_vi,
          book.id
        ]);
        console.log(`✅ Saved translations for ${book.title}`);
      } catch (e) {
        console.error(`❌ Failed to translate ${book.title}:`, e.message);
      }
      
      // Rate limit manually just in case
      await new Promise(r => setTimeout(r, 1000));
    }
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(console.error);
