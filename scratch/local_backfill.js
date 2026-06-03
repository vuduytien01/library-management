const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");

// Load from .env manually since this is a scratch script
const GEMINI_API_KEY = "REPLACED_WITH_REAL_KEY"; 
const SUPABASE_URL = "https://objzfxyenfkxvfjmqrcj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "REPLACED_WITH_REAL_KEY";

async function backfill() {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("Fetching books without embeddings...");
  const { data: books, error } = await supabase
    .from('books')
    .select('isbn, title, author, category, description')
    .is('embedding', null);

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log(`Found ${books.length} books to process.`);

  for (const book of books) {
    try {
      const text = `${book.title} ${book.author} ${book.category} ${book.description || ''}`.trim().substring(0, 5000);
      console.log(`Processing: ${book.title}...`);
      
      const result = await model.embedContent(text);
      const embedding = result.embedding.values;

      const { error: updateError } = await supabase
        .from('books')
        .update({ embedding })
        .eq('isbn', book.isbn);

      if (updateError) {
        console.error(`  Failed to update ${book.isbn}:`, updateError.message);
      } else {
        console.log(`  Success!`);
      }
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`  Error processing ${book.isbn}:`, e.message);
    }
  }
}

backfill();
