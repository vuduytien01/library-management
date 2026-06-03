const { Client } = require('pg');
require('dotenv').config();

async function checkProfile() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const userId = '362c0bbd-3649-497f-9864-7ae9d60aa5f2';
    
    console.log(`Checking profile for user: ${userId}`);
    
    const res = await client.query('SELECT * FROM public."profiles" WHERE id = $1', [userId]);
    
    if (res.rows.length > 0) {
      console.log('Profile found:', JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log('Profile NOT found.');
    }
  } catch (err) {
    console.error('Database error:', err.message);
  } finally {
    await client.end();
  }
}

checkProfile();
