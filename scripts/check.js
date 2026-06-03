const { createClient } = require("@supabase/supabase-js");

// We extract keys from src/api/supabase.ts
// But wait, the environment might not have node modules if we don't have them in the correct place.
// Let's just create a quick JS script to read the keys and call the DB.
const fs = require('fs');
const content = fs.readFileSync('src/api/supabase.ts', 'utf8');
const urlMatch = content.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = content.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
  console.log("Credentials not found.");
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').order('updated_at', { ascending: false }).limit(3);
  if (error) console.error("Error:", error);
  console.log("Latest profiles:", data);
}

check();
