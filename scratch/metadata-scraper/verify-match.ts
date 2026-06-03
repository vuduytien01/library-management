import * as mm from 'music-metadata';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { scrapeThuVienSachNoiBook, closeBrowser } from './thuviensachnoi-scraper';

async function verifyMatch(url: string) {
  console.log(`\n🔍 Verifying match for: ${url}`);
  
  // 1. Scrape metadata
  const metadata = await scrapeThuVienSachNoiBook(url, false); // Don't migrate yet
  if (!metadata) {
    console.error('❌ Failed to scrape metadata');
    return;
  }

  console.log(`\n📄 Scraped Metadata:`);
  console.log(`   Title:  ${metadata.title}`);
  console.log(`   Author: ${metadata.author}`);
  console.log(`   Audio:  ${metadata.source_url}`);

  const audioUrl = metadata.preview_url;
  if (!audioUrl) {
    console.error('❌ No audio URL found');
    return;
  }

  const tempPath = path.join(os.tmpdir(), 'verify-audio.mp3');
  try {
    console.log(`\n⏳ Downloading audio for ID3 check...`);
    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream',
      timeout: 30000
    });

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    // We only need the first 1MB usually for ID3 tags
    let bytesDownloaded = 0;
    const MAX_BYTES = 1024 * 1024; // 1MB

    await new Promise((resolve, reject) => {
      response.data.on('data', (chunk: any) => {
        bytesDownloaded += chunk.length;
        if (bytesDownloaded > MAX_BYTES) {
          response.data.destroy(); // Stop download
          resolve(null);
        }
      });
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 3. Parse ID3 tags (just to check if they exist)
    const audioMetadata = await mm.parseFile(tempPath);

    // 4. Comparison
    // Since ID3 tags are empty, we verify by checking if the audio filename correlates with the page slug
    const sourceId = metadata.source_id; // e.g., 'dac-nhan-tam-403'
    const audioFilename = audioUrl.split('/').pop() || ''; // e.g., '403-dac-nhan-tam-thuviensach.vn.mp3'
    
    // Extract words/numbers to compare
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // A simple check: do they share significant keywords?
    const slugParts = sourceId.split('-');
    let matchCount = 0;
    slugParts.forEach(part => {
        if (part.length > 2 && audioFilename.includes(part)) {
            matchCount++;
        }
    });
    
    const isCorrelated = matchCount >= Math.min(2, slugParts.length - 1) || audioFilename.includes(sourceId.replace(/-[0-9]+$/, ''));

    console.log(`\n📊 Match Result (Structural Verification):`);
    console.log(`   Page Slug:      ${sourceId}`);
    console.log(`   Audio Filename: ${audioFilename}`);
    console.log(`   Correlation:    ${isCorrelated ? '✅ STRONG MATCH (Filename correlates with Slug)' : '⚠️ WEAK MATCH'}`);
    
    if (audioMetadata.common.title) {
        const titleMatch = isSimilar(metadata.title, audioMetadata.common.title);
        console.log(`   ID3 Title Match: ${titleMatch ? '✅' : '⚠️'}`);
    } else {
        console.log(`   ID3 Tags:       ⚠️ Missing (Common for raw web MP3s)`);
    }

  } catch (err: any) {
    console.error(`❌ Error verifying: ${err.message}`);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    await closeBrowser();
  }
}

function isSimilar(s1: string, s2?: string): boolean {
  if (!s2) return false;
  const clean = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const c1 = clean(s1);
  const c2 = clean(s2);
  return c1.includes(c2) || c2.includes(c1);
}

const url = process.argv[2] || 'https://thuviensachnoi.vn/sach-noi/dac-nhan-tam.html';
verifyMatch(url);
