const { Client } = require('pg');

const dbUrl = "postgresql://postgres:vuduytien01@db.objzfxyenfkxvfjmqrcj.supabase.co:5432/postgres";
const client = new Client({
  connectionString: dbUrl,
});

async function test() {
  try {
    await client.connect();
    console.log("CONNECTED SUCCESS");
    const res = await client.query('SELECT NOW()');
    console.log(res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("CONNECTION ERROR:", err.message);
  }
}

test();
