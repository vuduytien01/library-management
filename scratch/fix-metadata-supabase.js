const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');

async function run() {
  console.log('Fetching audiobooks missing english title...');
  try {
    const { data: audiobooks, error } = await supabase
      .from('audiobook_metadata')
      .select('id, title, description, author, narrator');
      
    if (error) throw error;
    
    // Filter out audiobooks that need translation
    const needsTranslation = audiobooks.filter(b => !b.title_en || b.title_en === b.title || b.title_en === b.title_vi);
    
    console.log(`Found ${needsTranslation.length} audiobooks to translate.`);
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    for (const book of needsTranslation) {
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
        
        const { error: updateError } = await supabase
          .from('audiobook_metadata')
          .update({
            title_en: trans.title_en, title_vi: trans.title_vi,
            description_en: trans.description_en, description_vi: trans.description_vi,
            author_en: trans.author_en, author_vi: trans.author_vi,
            narrator_en: trans.narrator_en, narrator_vi: trans.narrator_vi,
          })
          .eq('id', book.id);
          
        if (updateError) throw updateError;
        
        console.log(`✅ Saved translations for ${book.title}`);
      } catch (e) {
        console.error(`❌ Failed to translate ${book.title}:`, e.message);
      }
      
      // Rate limit manually just in case
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch(e) {
      console.error(e);
  }
}

run();
