import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    const record = payload.record || payload 

    if (!record || !record.isbn) {
      console.error("Missing ISBN in payload", payload)
      throw new Error("No record with ISBN provided")
    }

    const { isbn, title, author, category, description } = record

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_BOOKS_API_KEY")
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found in environment")
      throw new Error("GEMINI_API_KEY not set")
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials missing", { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY })
      throw new Error("Supabase environment variables not set")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const textToEmbed = `${title} ${author || ''} ${category || ''} ${description || ''}`.trim().substring(0, 5000)

    console.log(`[INGEST] Generating embedding for ISBN: ${isbn}, Title: ${title}`)

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
      const errorText = await res.text()
      console.error(`[INGEST] Gemini API failed: ${res.status} ${errorText}`)
      throw new Error(`Gemini API error: ${res.status} ${errorText}`)
    }

    const data = await res.json()
    if (!data.embedding?.values) {
      console.error("[INGEST] Unexpected Gemini response format", data)
      throw new Error("Unexpected Gemini response format")
    }
    
    const embedding = data.embedding.values

    const { error: updateError } = await supabase
      .from('books')
      .update({ embedding })
      .eq('isbn', isbn)

    if (updateError) {
      console.error(`[INGEST] Database update failed for ISBN ${isbn}`, updateError)
      throw updateError
    }

    console.log(`[INGEST] SUCCESS: Updated embedding for ISBN: ${isbn}`)

    return new Response(JSON.stringify({ success: true, isbn }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error(`[INGEST ERROR] ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
