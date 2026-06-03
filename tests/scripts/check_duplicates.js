const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ACCESS_TOKEN);

async function checkDuplicates() {
  const { data, error } = await supabase
    .from('books')
    .select('isbn, title, count()')
    .group('isbn, title')
    .having('count() > 1');
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Duplicates found:', data);
}

checkDuplicates();
