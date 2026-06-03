import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { isbn } = await req.json()
    const GOOGLE_BOOKS_API_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY")
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!isbn) throw new Error("ISBN is required")
    const cleanIsbn = isbn.replace(/[- ]/g, "");

    // --- Data Fetching with Robustness ---
    
    // 1. Fetch from Google Books
    let googleItem = null;
    try {
      const googleRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}${GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : ''}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (googleRes.ok) {
        const googleData = await googleRes.json();
        googleItem = googleData.items?.[0]?.volumeInfo || null;
      }
    } catch (e) {
      console.error(`Google Books error for ISBN ${cleanIsbn}:`, e.message);
    }

    // 2. Fetch from Open Library
    let olItem = null;
    try {
      const olRes = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (olRes.ok) {
        const olData = await olRes.json();
        olItem = olData[`ISBN:${cleanIsbn}`] || null;
      }
    } catch (e) {
      console.error(`Open Library error for ISBN ${cleanIsbn}:`, e.message);
    }

    if (!googleItem && !olItem) {
      return new Response(JSON.stringify({ error: "Book not found in any provider" }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // --- Data Merging Strategy ---
    
    // Priority: Google for metadata, OpenLib for high-res covers
    const title = googleItem?.title || olItem?.title || 'Untitled';
    const author = googleItem?.authors?.join(', ') || olItem?.authors?.map((a: any) => a.name).join(', ') || 'Unknown';
    const coverUrl = olItem?.cover?.large || olItem?.cover?.medium || googleItem?.imageLinks?.thumbnail || googleItem?.imageLinks?.smallThumbnail;
    const description = googleItem?.description || olItem?.notes || '';
    const category = googleItem?.categories?.[0] || olItem?.subjects?.[0]?.name || 'Uncategorized';
    const pageCount = googleItem?.pageCount || olItem?.number_of_pages || null;
    const publishedDate = googleItem?.publishedDate || olItem?.publish_date || null;
    const language = googleItem?.language || 'vi'; 
    const averageRating = googleItem?.averageRating || null;
    const ratingsCount = googleItem?.ratingsCount || null;
    const edition = googleItem?.contentVersion || olItem?.identifiers?.openlibrary?.[0] || null;

    // --- Semantic Embedding Generation ---
    let embedding = null;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || GOOGLE_BOOKS_API_KEY;
    if (GEMINI_API_KEY) {
      try {
        const textToEmbed = `${title} ${author} ${category} ${description}`.trim().substring(0, 5000);
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: { parts: [{ text: textToEmbed }] }
            })
          }
        );
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          embedding = embedData.embedding.values;
        }
      } catch (e) {
        console.error("Embedding generation failed:", e.message);
      }
    }

    // Upsert into Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const { data: upsertedData, error } = await supabase
      .from('books')
      .upsert({
        isbn: cleanIsbn,
        title,
        author,
        cover_url: coverUrl,
        category,
        description,
        page_count: pageCount,
        published_date: publishedDate,
        language,
        average_rating: averageRating,
        ratings_count: ratingsCount,
        edition,
        embedding,
        google_data: {
          ...googleItem,
          ol_metadata: {
            subjects: olItem?.subjects?.map((s: any) => s.name),
            identifiers: olItem?.identifiers,
            weight: olItem?.weight,
            pagination: olItem?.pagination
          },
          sync_info: {
            synced_at: new Date().toISOString(),
            sources: {
              google_books: !!googleItem,
              open_library: !!olItem
            }
          }
        }
      })
      .select()
      .single()
    
    if (error) throw error
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: upsertedData
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("Sync worker error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

