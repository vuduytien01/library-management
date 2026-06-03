import axios from "axios";
import * as cheerio from "cheerio";

async function testSearch(keyword: string) {
  const url = `https://thuviensachnoi.vn/search/ajax-home.php?keyword=${encodeURIComponent(keyword)}`;
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log(`Results for "${keyword}":`);
    const $ = cheerio.load(res.data);
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href) {
        console.log(`  - Link: ${href} | Text: ${text}`);
      }
    });
  } catch (e: any) {
    console.error(`Error searching "${keyword}":`, e.message);
  }
}

async function run() {
  await testSearch("Hiểu Về Trái Tim");
  await testSearch("Đường Mây Qua Xứ Tuyết");
}

run();
