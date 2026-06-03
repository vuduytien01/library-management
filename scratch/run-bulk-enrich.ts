
import { booksService } from '../src/features/books/books.service';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function runEnrichment() {
  console.log('🚀 Starting Bulk Enrichment with Open Library priority...');
  try {
    const result = await booksService.bulkEnrichAudiobooks();
    console.log('✅ Enrichment Complete!');
    console.log(`📊 Total processed: ${result.total}`);
    console.log(`✨ Updated: ${result.updated}`);
  } catch (error) {
    console.error('❌ Enrichment failed:', error);
  }
}

runEnrichment();
