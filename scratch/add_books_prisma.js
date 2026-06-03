
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding books via Prisma...');
  
  const books = [
    {
      isbn: '9781567184853',
      title: 'Journey of Souls: Case Studies of Life Between Lives',
      author: 'Michael Newton',
      metadata: {
        description: 'A non-fiction work based on the author\'s hypnotherapy practice, detailing case studies of individuals recalling their experiences in the spirit world between incarnations.',
        publisher: 'Llewellyn Publications',
        published_date: '2002-09-01'
      },
      coverUrl: 'https://covers.openlibrary.org/b/isbn/9781567184853-L.jpg',
      totalCopies: 3,
      availableCopies: 3,
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
      coverUrl: 'https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg',
      totalCopies: 3,
      availableCopies: 3,
      category: 'Fiction'
    }
  ];

  for (const book of books) {
    const result = await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: book,
      create: book,
    });
    console.log(`Successfully added/updated: ${result.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
