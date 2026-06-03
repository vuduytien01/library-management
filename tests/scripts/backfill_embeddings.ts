import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function backfill() {
  console.log('Starting backfill process...')
  let totalUpdated = 0
  let hasMore = true

  while (hasMore) {
    try {
      const { data, error } = await supabase.functions.invoke('backfill-embeddings')
      
      if (error) {
        console.error('Error calling backfill function:', error)
        break
      }

      console.log(`Updated ${data.updated} books. Remaining might be left.`)
      totalUpdated += data.updated
      
      if (data.updated === 0) {
        hasMore = false
      }
      
      // Safety break to avoid infinite loop
      if (totalUpdated > 500) break 
      
    } catch (err) {
      console.error('Request failed:', err)
      break
    }
  }

  console.log(`Backfill complete. Total books updated: ${totalUpdated}`)
}

backfill()
