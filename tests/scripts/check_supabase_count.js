const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealCount() {
  try {
    const { data: books, error } = await supabase.from('books').select('id, title, total_copies, available_copies');
    if (error) throw error;

    console.log("--- SUPABASE DATABASE REAL STATS ---");
    console.log(`Total Book Titles: ${books.length}`);
    let totalCopies = 0;
    books.forEach(b => {
      totalCopies += b.total_copies || 0;
      console.log(` - ${b.title}: ${b.available_copies}/${b.total_copies}`);
    });
    console.log(`Total Physical Copies: ${totalCopies}`);
  } catch (err) {
    console.error("SUPABASE ERROR:", err.message);
  }
}

checkRealCount();
