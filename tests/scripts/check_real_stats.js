const { Client } = require('pg');

const dbUrl = "postgresql://postgres:vuduytien01@db.objzfxyenfkxvfjmqrcj.supabase.co:5432/postgres";
const client = new Client({ connectionString: dbUrl });

async function checkStats() {
  try {
    await client.connect();
    console.log("--- REAL DATABASE STATS ---");
    
    // 1. Total Books Count
    const booksRes = await client.query('SELECT COUNT(*) as count, SUM(total_copies) as total_copies, SUM(available_copies) as available_copies FROM books');
    console.log("BOOKS TABLE:", booksRes.rows[0]);
    
    // 2. Active Borrows
    const borrowRes = await client.query("SELECT COUNT(*) as count FROM borrow_records WHERE status = 'BORROWED'");
    console.log("ACTIVE BORROWS:", borrowRes.rows[0]);

    // 3. Overdue Records
    const overdueRes = await client.query("SELECT COUNT(*) as count FROM borrow_records WHERE status = 'BORROWED' AND due_date < NOW()");
    console.log("OVERDUE RECORDS:", overdueRes.rows[0]);

    await client.end();
  } catch (err) {
    console.error("STATS CHECK ERROR:", err.message);
  }
}

checkStats();
