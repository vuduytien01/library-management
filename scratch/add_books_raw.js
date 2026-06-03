
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const books = [
  {
    isbn: '9781567184853',
    title: 'Journey of Souls: Case Studies of Life Between Lives',
    author: 'Michael Newton',
    metadata: JSON.stringify({
      description: 'A non-fiction work based on the author\'s hypnotherapy practice, detailing case studies of individuals recalling their experiences in the spirit world between incarnations.',
      publisher: 'Llewellyn Publications',
      published_date: '2002-09-01'
    }),
    cover_url: 'https://covers.openlibrary.org/b/isbn/9781567184853-L.jpg',
    total_copies: 3,
    available_copies: 3,
    category: 'Non-fiction'
  },
  {
    isbn: '9780316769488',
    title: 'The Catcher in the Rye',
    author: 'J.D. Salinger',
    metadata: JSON.stringify({
      description: 'A classic novel featuring the protagonist Holden Caulfield, focusing on themes of teenage alienation, grief, and the struggle to navigate the transition into adulthood.',
      publisher: 'Little, Brown and Company',
      published_date: '1951-07-16'
    }),
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg',
    total_copies: 3,
    available_copies: 3,
    category: 'Fiction'
  }
];

async function addBooks() {
  try {
    await client.connect();
    console.log('Connected to DB. Inserting books via raw SQL...');

    for (const book of books) {
      const query = `
        INSERT INTO books (isbn, title, author, metadata, cover_url, total_copies, available_copies, category)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (isbn) DO UPDATE SET
          title = EXCLUDED.title,
          author = EXCLUDED.author,
          metadata = EXCLUDED.metadata,
          cover_url = EXCLUDED.cover_url,
          total_copies = EXCLUDED.total_copies,
          available_copies = EXCLUDED.available_copies,
          category = EXCLUDED.category
      `;
      const values = [
        book.isbn, book.title, book.author, book.metadata, 
        book.cover_url, book.total_copies, book.available_copies, book.category
      ];
      
      await client.query(query, values);
      console.log(`Successfully upserted: ${book.title}`);
    }
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

addBooks();
