const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:vuduytien01@db.objzfxyenfkxvfjmqrcj.supabase.co:5432/postgres',
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT n.nspname as schema, t.typname as name 
      FROM pg_type t 
      LEFT JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE t.typcategory = 'E'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
