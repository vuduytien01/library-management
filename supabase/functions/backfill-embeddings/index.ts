import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_BOOKS_API_KEY")

    if (!GEMINI_API_KEY) {
      console.error("[BACKFILL] GEMINI_API_KEY not found")
      throw new Error("GEMINI_API_KEY not set")
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Fetch books without embeddings
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('isbn, title, author, category, description')
      .is('embedding', null)
      .limit(20); 

    if (fetchError) throw fetchError

    console.log(`[BACKFILL] Processing batch of ${books?.length} books...`)
    let successCount = 0
    let failureCount = 0

    for (const book of books || []) {
      try {
        const textToEmbed = `${book.title} ${book.author || ''} ${book.category || ''} ${book.description || ''}`.trim().substring(0, 5000)
        
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: { parts: [{ text: textToEmbed }] },
              outputDimensionality: 768
            })
          }
        )

        if (!res.ok) {
          const errText = await res.text()
          console.error(`[BACKFILL] Gemini failed for ISBN ${book.isbn}: ${res.status} ${errText}`)
          failureCount++
          continue
        }

        const data = await res.json()
        const embedding = data.embedding?.values

        if (!embedding) {
          console.error(`[BACKFILL] No embedding values for ISBN ${book.isbn}`)
          failureCount++
          continue
        }

        const { error: updateError } = await supabase
          .from('books')
          .update({ embedding })
          .eq('isbn', book.isbn)

        if (updateError) {
          console.error(`[BACKFILL] DB update failed for ISBN ${book.isbn}:`, updateError)
          failureCount++
        } else {
          successCount++
        }
      } catch (itemErr) {
        console.error(`[BACKFILL] Unexpected error for ISBN ${book.isbn}:`, itemErr.message)
        failureCount++
      }
    }

    console.log(`[BACKFILL] COMPLETED: ${successCount} success, ${failureCount} failed.`)

    return new Response(JSON.stringify({ 
      success: true, 
      processed: books?.length,
      updated: successCount,
      failed: failureCount,
      remaining: books?.length === 20 ? 'More books might remain.' : 'All pending books processed.'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
