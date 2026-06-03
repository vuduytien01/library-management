const titles = [
  "The Wolf of Wall Street Jordan Belfort",
  "Catch Me If You Can Frank Abagnale",
  "Because Our Fathers Lied Craig McNamara",
  "Xây dựng và phát triển nền văn hóa Việt Nam tiên tiến, đậm đà bản sắc dân tộc Nguyễn Phú Trọng",
  "Chernobyl: The History of a Nuclear Catastrophe Serhii Plokhy",
  "What I Talk About When I Talk About Running Haruki Murakami",
  "On Writing: A Memoir of the Craft Stephen King",
  "Long Walk to Freedom Nelson Mandela",
  "The Autobiography of Malcolm X",
  "The Help Kathryn Stockett",
  "Into the Wild Jon Krakauer",
  "Nomadland Jessica Bruder",
  "Alan Turing: The Enigma Andrew Hodges",
  "Security Analysis Benjamin Graham",
  "The Intelligent Investor Benjamin Graham",
  "Business Adventures John Brooks",
  "First on the Moon Neil Armstrong",
  "Minimalism: Live a Meaningful Life",
  "The Infinity Machine Demis Hassabis DeepMind",
  "Kinh Trường Bộ",
  "A Life on Our Planet David Attenborough",
  "Behind the Dolphin Smile Richard O'Barry",
  "Tim: The Official Biography of Avicii",
  "An Actor Prepares Constantin Stanislavski",
  "Building a Character Constantin Stanislavski",
  "Creating a Role Constantin Stanislavski"
];

const fetch = require('node-fetch');

async function getIsbn(title) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}`);
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    
    const identifiers = item.volumeInfo.industryIdentifiers;
    const isbn13 = identifiers?.find(id => id.type === 'ISBN_13')?.identifier;
    const isbn10 = identifiers?.find(id => id.type === 'ISBN_10')?.identifier;
    
    return isbn13 || isbn10 || null;
  } catch (e) {
    console.error(`Error searching for ${title}:`, e);
    return null;
  }
}

async function syncBook(isbn) {
  try {
    const res = await fetch('https://objzfxyenfkxvfjmqrcj.supabase.co/functions/v1/sync-book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ isbn })
    });
    return await res.json();
  } catch (e) {
    console.error(`Error syncing ISBN ${isbn}:`, e);
    return null;
  }
}

async function main() {
  for (const title of titles) {
    console.log(`Searching for: ${title}`);
    const isbn = await getIsbn(title);
    if (isbn) {
      console.log(`Found ISBN: ${isbn}. Syncing...`);
      const result = await syncBook(isbn);
      console.log(`Result:`, result);
    } else {
      console.log(`No ISBN found for ${title}`);
    }
    // Rate limiting delay
    await new Promise(r => setTimeout(r, 1000));
  }
}

main();
