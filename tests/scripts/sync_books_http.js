const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE CONFIG MISSING");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAndClean() {
  try {
    console.log("STARTING DATA SYNCHRONIZATION...");

    // 1. Fetch all books
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('*');

    if (fetchError) throw fetchError;

    console.log(`CURRENT BOOKS IN DB: ${books.length}`);

    // Identfiy duplicates by ISBN
    const seenIsbns = new Set();
    const toDelete = [];
    const uniqueBooks = [];

    for (const book of books) {
      if (seenIsbns.has(book.isbn)) {
        toDelete.push(book.id);
      } else {
        seenIsbns.add(book.isbn);
        uniqueBooks.push(book);
      }
    }

    if (toDelete.length > 0) {
      console.log(`CLEANING ${toDelete.length} DUPLICATES...`);
      const { error: delError } = await supabase
        .from('books')
        .delete()
        .in('id', toDelete);
      if (delError) throw delError;
      console.log("DUPLICATES REMOVED");
    } else {
      console.log("NO DUPLICATES FOUND");
    }

    // 2. Ensure total count is 14 for the remaining 4 titles
    // This is a manual correction for the "Restoration" goal
    const targetMap = {
      '9780316769174': 4, // The Catcher in the Rye
      '9780061120084': 3, // To Kill a Mockingbird
      '9780451524935': 4, // 1984
      '9780544003415': 3, // The Lord of the Rings
    };

    console.log("SYNCHRONIZING STOCK COUNTS...");
    for (const book of uniqueBooks) {
      const targetCopies = targetMap[book.isbn];
      if (targetCopies && book.total_copies !== targetCopies) {
        const { error: upError } = await supabase
          .from('books')
          .update({ 
            total_copies: targetCopies,
            available_copies: targetCopies // Reset for restoration
          })
          .eq('id', book.id);
        if (upError) throw upError;
        console.log(`UPDATED ${book.title} TO ${targetCopies} COPIES`);
      }
    }

    console.log("DATA SYNCHRONIZATION COMPLETE");
  } catch (err) {
    console.error("SYNC ERROR:", err.message);
  }
}

syncAndClean();
