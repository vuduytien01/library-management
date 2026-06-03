import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await supabase
    .from("audiobook_metadata")
    .select("id, title, author, narrator, cover_url, isbn, categories, tags, source_platform, source_id, source_url, description");
  if (error) {
    console.error(error);
    return;
  }
  for (const ab of data || []) {
    console.log(`Title: ${ab.title}`);
    console.log(`  Author: ${ab.author}`);
    console.log(`  Narrator: ${ab.narrator}`);
    console.log(`  Cover: ${ab.cover_url}`);
    console.log(`  ISBN: ${ab.isbn}`);
    console.log(`  Tags: ${ab.tags}`);
    console.log(`  Categories: ${ab.categories}`);
    console.log(`  Source ID: ${ab.source_id}`);
    console.log(`  Source URL: ${ab.source_url}`);
  }
}

run();
