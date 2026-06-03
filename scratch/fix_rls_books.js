
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function fixRls() {
  try {
    await client.connect();
    console.log('Connected to DB. Fixing RLS policies for "books" table...');

    // 1. Ensure RLS is enabled (it usually is)
    await client.query('ALTER TABLE books ENABLE ROW LEVEL SECURITY');
    
    // 2. Drop existing pick-all policy if it exists to avoid conflicts
    await client.query('DROP POLICY IF EXISTS "Allow public read-only access" ON books');
    
    // 3. Create a fresh policy for SELECT access
    await client.query('CREATE POLICY "Allow public read-only access" ON books FOR SELECT USING (true)');
    
    console.log('RLS Policy "Allow public read-only access" created successfully.');

    // 4. Verify data one more time
    const res = await client.query('SELECT isbn, title FROM books');
    console.log('Verified Books in table "books":', res.rows.length);
    res.rows.forEach(r => console.log(`- ${r.title} (ISBN: ${r.isbn})`));

  } catch (err) {
    console.error('Error fixing RLS:', err.stack);
  } finally {
    await client.end();
  }
}

fixRls();
