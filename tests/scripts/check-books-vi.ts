import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  // Count Vietnamese books
  const { count } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true })
    .eq('language', 'vi');
  console.log('Vietnamese books total:', count);

  // List a few
  const { data } = await supabase
    .from('books')
    .select('title, author, isbn, description')
    .eq('language', 'vi')
    .limit(10);

  if (data) {
    data.forEach((b: any) => {
      console.log(`  - ${b.title} | Author: ${b.author} | ISBN: ${b.isbn}`);
    });
  }

  // Also check audiobook_metadata for thuviensachnoi
  const { data: audiobooks, count: abCount } = await supabase
    .from('audiobook_metadata')
    .select('title, author, narrator, source_platform', { count: 'exact' })
    .eq('source_platform', 'thuviensachnoi')
    .limit(10);

  console.log('\nThuviensachnoi audiobooks total:', abCount);
  if (audiobooks) {
    audiobooks.forEach((ab: any) => {
      console.log(`  - ${ab.title} | author(=narrator): ${ab.author} | narrator: ${ab.narrator}`);
    });
  }

  // Check all audiobooks
  const { data: allAb, count: allAbCount } = await supabase
    .from('audiobook_metadata')
    .select('title, author, narrator, source_platform', { count: 'exact' })
    .limit(10);

  console.log('\nAll audiobooks total:', allAbCount);
  if (allAb) {
    allAb.forEach((ab: any) => {
      console.log(`  - [${ab.source_platform}] ${ab.title} | author: ${ab.author} | narrator: ${ab.narrator}`);
    });
  }
}

run();
