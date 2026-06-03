import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(__dirname, '../.env') });

import { booksService } from '../src/features/books/books.service';

async function run() {
  console.log("Starting bulk enrichment...");
  try {
    const res = await booksService.bulkEnrichAudiobooks();
    console.log("Enrichment complete:", res);
  } catch(e) {
    console.error("Error:", e);
  }
}

run();
