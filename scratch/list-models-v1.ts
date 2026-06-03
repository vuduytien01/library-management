import * as dotenv from 'dotenv';
dotenv.config();
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('List models failed:', e);
  }
}
listModels();
