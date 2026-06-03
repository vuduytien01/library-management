
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const booksToAdd = [
  {
    isbn: '9781567184853',
    title: 'Journey of Souls: Case Studies of Life Between Lives',
    author: 'Michael Newton',
    metadata: {
      description: 'A non-fiction work based on the author\'s hypnotherapy practice, detailing case studies of individuals recalling their experiences in the spirit world between incarnations.',
      publisher: 'Llewellyn Publications',
      published_date: '2002-09-01'
    },
    cover_url: 'https://covers.openlibrary.org/b/isbn/9781567184853-L.jpg',
    total_copies: 3,
    available_copies: 3,
    category: 'Non-fiction'
  },
  {
    isbn: '9780316769488',
    title: 'The Catcher in the Rye',
    author: 'J.D. Salinger',
    metadata: {
      description: 'A classic novel featuring the protagonist Holden Caulfield, focusing on themes of teenage alienation, grief, and the struggle to navigate the transition into adulthood.',
      publisher: 'Little, Brown and Company',
      published_date: '1951-07-16'
    },
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg',
    total_copies: 3,
    available_copies: 3,
    category: 'Fiction'
  }
];

async function addBooks() {
  console.log('Adding books to database with metadata field...');
  for (const book of booksToAdd) {
    const { data, error } = await supabase
      .from('books')
      .upsert(book, { onConflict: 'isbn' });
    
    if (error) {
      console.error(`Error adding book ${book.title}:`, error);
    } else {
      console.log(`Successfully added/updated: ${book.title}`);
    }
  }
}

addBooks();
