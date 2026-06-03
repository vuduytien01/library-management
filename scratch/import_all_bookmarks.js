const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const csvPath = 'c:\\Users\\tien2004\\Downloads\\library-app\\bookmarks_output.csv';
const blacklist = [
  'battery report', 'iqair', 'chongluadao', 'mega', 'onedrive', 'pcloud',
  'datadog', 'appwrite', 'configcat', 'digitalocean', 'figma', 'shadcn',
  'vadin', 'mastra', 'codecov', 'travis ci', 'vercel', 'yt studio', 'samsung',
  'vid compress', 'cổng thông tin sinh viên', 'cháy mạch', 'sắt bắc-nam',
  'zalo', 'github', 'amazon', 'youtube', 'google maps', 'gmail', 'calendar',
  'docs', 'sheets', 'slides', 'mermaid', 'sonatype', 'flyway', 'vaadin',
  'roboflow', 'yolo', 'cnn', ' paddle-ocr', 'asr', 'tensorrt', 'cuda', 'bfgs',
  'bytetrack', 'deepsort', 'cellpose', 'arcface', 'mtcnn', 'facenet', 'csrnet',
  'unet', 'stylegan', 'efficientnet', 'resnet', 'hrnet', 'slowfast', 'timesformer',
  'monodepth2', 'lanenet', 'vgg', 'adain', 'trocr', 'deepface', 'transformer',
  'clip', 'layout lm', 'donut', 'mantranet', 'mvss net', 'deoldify', 'ddcolor',
  'pointnet', 'yolov', 'mobilenet', 'stable diffusion', 'graspnet', 'esrgan',
  'rnn', 'crnn', 'vanilla rnn', 'lstm', 'gru', 'cyclegan', 'seq2seq', 'nlm',
  'ros', 'plantvillage', 'openpose', 'insightface', 'dlib', 'plantdoc',
  'fieldplant', 'cocodataset', 'nerf-studio', 'aruco', 'dt-apriltag', 'paddleocr',
  'arcore', 'unity', 'mfcc', 'surya', 'doctr', 'pybullet', 'robot-framework'
];

async function getIsbn(title) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1`);
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    
    const identifiers = item.volumeInfo.industryIdentifiers;
    const isbn13 = identifiers?.find(id => id.type === 'ISBN_13')?.identifier;
    const isbn10 = identifiers?.find(id => id.type === 'ISBN_10')?.identifier;
    
    // Return ISBN and also the title found to verify relevance
    return { 
      isbn: isbn13 || isbn10 || null,
      foundTitle: item.volumeInfo.title,
      author: item.volumeInfo.authors?.[0]
    };
  } catch (e) {
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
    return { error: e.message };
  }
}

function parseCsv(content) {
  const lines = content.split('\n');
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const firstComma = line.indexOf(',');
    const name = line.substring(0, firstComma).trim();
    const url = line.substring(firstComma + 1).trim();
    
    // Simple heuristic: if it's in blacklist, skip
    const isBlacklisted = blacklist.some(term => name.toLowerCase().includes(term) || url.toLowerCase().includes(term));
    if (isBlacklisted) continue;
    
    // Extract search query from Google URL if possible
    let query = name;
    if (url.includes('google.com/search')) {
      const urlObj = new URL(url);
      const q = urlObj.searchParams.get('q');
      if (q) query = q;
    }
    
    results.push({ name, query, url });
  }
  return results;
}

async function main() {
  const content = fs.readFileSync(csvPath, 'utf8');
  const items = parseCsv(content);
  console.log(`Total items to process: ${items.length}`);
  
  for (const item of items) {
    console.log(`Processing: ${item.name} (${item.query})`);
    const bookInfo = await getIsbn(item.query);
    
    if (bookInfo && bookInfo.isbn) {
      console.log(`  Found Book: "${bookInfo.foundTitle}" by ${bookInfo.author}. ISBN: ${bookInfo.isbn}`);
      const res = await syncBook(bookInfo.isbn);
      console.log(`  Sync Result: ${res.success ? 'Success' : (res.error || 'Failed')}`);
    } else {
      console.log(`  No book found for query.`);
    }
    
    // Delay to avoid hitting rate limits
    await new Promise(r => setTimeout(r, 500));
  }
}

main();
