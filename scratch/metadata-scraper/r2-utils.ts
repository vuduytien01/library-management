import { execSync } from 'child_process';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const BUCKET_NAME = 'biblio-tech-audio';

/**
 * Downloads a file from a URL and uploads it to R2 using wrangler CLI
 * Returns the public-facing URL (assuming R2 domain or worker proxy)
 */
export async function migrateToR2(url: string, filename: string): Promise<string | null> {
  const tempDir = path.join(os.tmpdir(), 'biblio-tech-scraper');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  const tempPath = path.join(tempDir, filename);
  
  try {
    console.log(`[R2] Downloading: ${url} -> ${tempPath}`);
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000 * 5 // 5 minutes timeout for large files
    });

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[R2] Uploading ${filename} to bucket ${BUCKET_NAME}...`);
    // Use wrangler CLI to upload
    const command = `npx wrangler r2 object put ${BUCKET_NAME}/${filename} --file="${tempPath}"`;
    execSync(command, { stdio: 'inherit' });

    console.log(`[R2] Success!`);
    
    // Cleanup
    fs.unlinkSync(tempPath);

    // Return the relative path or the assumed worker path
    // The user can proxy this via the r2-audio-worker
    return filename; 
  } catch (err: any) {
    console.error(`[R2] Migration failed for ${filename}: ${err.message}`);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return null;
  }
}
