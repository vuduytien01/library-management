import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: books, error } = await supabase
    .from("books")
    .select("isbn, title, author, cover_url, category, google_data");
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Total books: ${books?.length}`);
  for (const b of books || []) {
    console.log(`- Title: ${b.title} | Author: ${b.author} | ISBN: ${b.isbn}`);
  }
}

run();
