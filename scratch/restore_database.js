const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = "postgresql://postgres:vuduytien01@db.objzfxyenfkxvfjmqrcj.supabase.co:5432/postgres";
const client = new Client({ connectionString: dbUrl });

async function restoreDatabase() {
  try {
    await client.connect();
    console.log("CONNECTED TO DATABASE");

    // 1. Execute borrow_return_upgrade.sql
    console.log("DEPLOYING UPGRADE LOGIC...");
    const sqlPath = path.join(__dirname, '..', 'borrow_return_upgrade.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log("UPGRADE LOGIC DEPLOYED SUCCESSFULLY");

    // 2. Cleanup Duplicates
    console.log("CLEANING DUPLICATE BOOKS...");
    // Keep the one with more physical copies if duplicate
    const cleanupQuery = `
      WITH CTE AS (
        SELECT id, isbn, ROW_NUMBER() OVER (PARTITION BY isbn ORDER BY total_copies DESC) as rn
        FROM books
        WHERE isbn IS NOT NULL
      )
      DELETE FROM books WHERE id IN (SELECT id FROM CTE WHERE rn > 1)
    `;
    const delRes = await client.query(cleanupQuery);
    console.log(`CLEANED ${delRes.rowCount} DUPLICATE ENTRIES`);

    // 3. Reset available_copies (Full replenishment for restoration)
    await client.query('UPDATE books SET available_copies = total_copies');
    console.log("INVENTORY REPLENISHED");

    await client.end();
    console.log("DATABASE RESTORATION COMPLETE");
  } catch (err) {
    console.error("RESTORATION ERROR:", err.message);
    process.exit(1);
  }
}

restoreDatabase();
