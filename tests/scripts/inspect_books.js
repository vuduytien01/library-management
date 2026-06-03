const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function inspectBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('isbn, title, author');
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Books in database:');
  data.forEach(b => console.log(`ISBN: "${b.isbn}" | Title: "${b.title}"`));
}

inspectBooks();
