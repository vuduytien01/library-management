const fetch = require('node-fetch');

async function runBackfill() {
  const SUPABASE_URL = 'https://objzfxyenfkxvfjmqrcj.supabase.co';
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
    return;
  }

  let totalUpdated = 0;
  let hasMore = true;

  console.log('Starting total backfill process...');

  while (hasMore) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/backfill-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      const data = await res.json();
      
      if (data.error) {
        console.error('Edge Function Error:', data.error);
        break;
      }

      totalUpdated += data.updated;
      console.log(`Updated ${data.updated} books. Total: ${totalUpdated}. Remaining approx: ${data.processed === 10 ? 'More' : 'None'}`);

      if (data.updated === 0 || data.processed < 10) {
        hasMore = false;
      }

      // Small delay to avoid hitting Gemini rate limits too hard
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error('Fetch error:', e.message);
      break;
    }
  }

  console.log(`Backfill complete. Total books updated: ${totalUpdated}`);
}

runBackfill();
