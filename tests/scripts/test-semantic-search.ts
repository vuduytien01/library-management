import { aiService } from '../src/services/aiService';
import { supabase } from '../src/api/supabase';

async function testSemanticSearch() {
  console.log('--- Testing BiblioAI Semantic Search ---');
  
  const query = 'sách về tâm lý học và hạnh phúc';
  console.log(`Query: "${query}"`);
  
  try {
    console.log('1. Generating embedding...');
    const embedding = await aiService.generateEmbedding(query);
    console.log(`Embedding generated (length: ${embedding.length})`);
    
    console.log('2. Calling match_books RPC...');
    const { data, error } = await supabase.rpc('match_books', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5
    });
    
    if (error) throw error;
    
    console.log('3. Results:');
    if (data && data.length > 0) {
      data.forEach((book: any, i: number) => {
        console.log(`${i + 1}. [${(book.similarity * 100).toFixed(1)}%] ${book.title} - ${book.author}`);
      });
    } else {
      console.log('No matching books found above threshold 0.5.');
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testSemanticSearch();
