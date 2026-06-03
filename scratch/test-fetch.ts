import axios from "axios";
import * as cheerio from "cheerio";

async function test() {
  const url = "https://thuviensachnoi.vn/sach-noi/hieu-ve-trai-tim.html";
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const $ = cheerio.load(res.data);
    const narrator = $('a[href*="/tac-gia/"]').text().trim();
    console.log("Narrator from Cheerio:", narrator);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

test();
