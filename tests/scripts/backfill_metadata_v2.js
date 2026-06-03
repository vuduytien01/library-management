const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://objzfxyenfkxvfjmqrcj.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ianpmeHllbmZreHZmam1xcmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTg3NTYsImV4cCI6MjA5MTIzNDc1Nn0.m6cQYSsgYH5b2FvgldBEewLcMbZx8S6iyaW2bvjhXco';
const SYNC_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/sync-book`;

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function backfill() {
  console.log("Starting metadata backfill (v2 - using ANON_KEY)...");
  
  const { data: books, error } = await supabase
    .from('books')
    .select('isbn, title')
    .is('language', null);

  if (error) {
    console.error("Error fetching books:", error);
    return;
  }

  console.log(`Found ${books.length} books to update.`);

  for (const book of books) {
    console.log(`Syncing metadata for: ${book.title} (ISBN: ${book.isbn})...`);
    
    try {
      const response = await fetch(SYNC_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({ isbn: book.isbn })
      });

      if (response.ok) {
        console.log(`✅ Success: ${book.title}`);
      } else {
        const errText = await response.text();
        console.error(`❌ Failed: ${book.title} - ${errText}`);
      }
    } catch (err) {
      console.error(`Error calling sync function: ${err.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log("Backfill complete!");
}

backfill();
