const fetch = require('node-fetch');

async function backfill() {
  const SUPABASE_URL = 'https://objzfxyenfkxvfjmqrcj.supabase.co';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  
  console.log('Fetching existing books...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/books?select=isbn,title`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const books = await res.json();
  console.log(`Found ${books.length} books to update.`);

  for (const book of books) {
    console.log(`Updating metadata for: ${book.title} (ISBN: ${book.isbn})...`);
    try {
      const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/sync-book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ isbn: book.isbn })
      });
      const data = await syncRes.json();
      console.log(`  Result: ${data.success ? 'Success' : 'Failed'}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    // Rate limit delay
    await new Promise(r => setTimeout(r, 1000));
  }
}

backfill();
