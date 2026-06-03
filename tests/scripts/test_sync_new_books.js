const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function testSync(isbn, label) {
  console.log(`Syncing ${label} (ISBN: ${isbn})...`);
  const { data, error } = await supabase.functions.invoke('sync-book', {
    body: { isbn }
  });
  
  if (error) {
    console.error(`Error syncing ${label}:`, error);
    return;
  }
  
  console.log(`Success ${label}:`, data);
}

async function runTests() {
  await testSync('9780679723950', 'Memories, Dreams, Reflections');
  await testSync('9780465019779', 'The Interpretation of Dreams');
}

runTests();
