const { Client } = require('pg');

const dbUrl = "postgresql://postgres.objzfxyenfkxvfjmqrcj:vuduytien01@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. Check ENUM values
    const enumQuery = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'user_role'
    `);
    console.log("Enum values for user_role:", enumQuery.rows);

    // 3. See the top 5 latest profiles
    const profiles = await client.query(`
      SELECT id, full_name, role 
      FROM profiles 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log("Latest profiles:", profiles.rows);

  } catch (err) {
    console.error("Error connecting to DB:", err.message);
  } finally {
    await client.end();
  }
}

run();
