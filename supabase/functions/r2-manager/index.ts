import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { S3Client } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Verify Super Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Super Admin only' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const { action, path, prefix } = await req.json()

    // R2 Config
    const r2Config = {
      endPoint: Deno.env.get('R2_ENDPOINT') ?? '',
      accessKey: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
      secretKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
      bucket: Deno.env.get('R2_BUCKET_NAME') ?? '',
      region: 'auto',
    }

    if (!r2Config.accessKey || !r2Config.secretKey || !r2Config.endPoint) {
      throw new Error('R2 configuration missing in environment variables (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME)')
    }

    const s3Client = new S3Client({
      endPoint: r2Config.endPoint.replace('https://', ''),
      accessKey: r2Config.accessKey,
      secretKey: r2Config.secretKey,
      region: r2Config.region,
      useSSL: true,
      pathStyle: true,
    })

    if (action === 'list') {
      const objects = []
      const folders = new Set<string>()
      
      // List objects with prefix
      for await (const obj of s3Client.listObjects({ prefix: prefix || '' })) {
        const relativePath = prefix ? obj.key.replace(prefix, '') : obj.key
        
        if (relativePath.includes('/')) {
          const folderName = relativePath.split('/')[0]
          folders.add(prefix ? `${prefix}${folderName}/` : `${folderName}/`)
        } else if (obj.key.toLowerCase().endsWith('.mp3') || obj.key.toLowerCase().endsWith('.m4a')) {
          objects.push({
            key: obj.key,
            size: obj.size,
            lastModified: obj.lastModified,
          })
        }
      }

      // Check which ones are already imported
      const { data: existing } = await supabaseClient
        .from('audiobook_metadata')
        .select('source_id')
        .eq('source_platform', 'r2')

      const existingIds = new Set(existing?.map(e => e.source_id) || [])

      return new Response(JSON.stringify({ 
        success: true, 
        files: objects.map(o => ({ ...o, isImported: existingIds.has(o.key) })),
        folders: Array.from(folders).map(f => ({ key: f, isImported: false }))
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'get-metadata') {
      if (!path) throw new Error('Path is required')
      
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
      const GOOGLE_BOOKS_API_KEY = Deno.env.get('GOOGLE_BOOKS_API_KEY')

      // Use Gemini to parse path
      const filename = path.split('/').pop() || path
      let suggestedTitle = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
      let suggestedAuthor = ""

      if (GEMINI_API_KEY) {
        try {
          const prompt = `Analyze the following file path of an audiobook and extract the Title and Author.
          Path: "${path}"
          Return as JSON: {"title": "...", "author": "..."}
          Only return raw JSON, no markdown.`
          
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          })
          const geminiData = await geminiRes.json()
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ""
          const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
          suggestedTitle = parsed.title || suggestedTitle
          suggestedAuthor = parsed.author || ""
        } catch (e) {
          console.error("Gemini metadata extraction failed:", e)
        }
      }

      // Search Google Books
      let googleMetadata = null
      try {
        const query = encodeURIComponent(`intitle:${suggestedTitle}${suggestedAuthor ? `+inauthor:${suggestedAuthor}` : ''}`)
        const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1${GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : ''}`)
        const gData = await gRes.json()
        googleMetadata = gData.items?.[0]?.volumeInfo || null
      } catch (e) {
        console.error("Google Books enrichment failed:", e)
      }

      return new Response(JSON.stringify({ 
        success: true, 
        suggested: {
          title: googleMetadata?.title || suggestedTitle,
          author: googleMetadata?.authors?.join(', ') || suggestedAuthor,
          description: googleMetadata?.description || "",
          cover_url: googleMetadata?.imageLinks?.thumbnail?.replace('http://', 'https://') || "",
          isbn: googleMetadata?.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier || "",
          categories: googleMetadata?.categories || []
        }
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    throw new Error('Invalid action')

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
