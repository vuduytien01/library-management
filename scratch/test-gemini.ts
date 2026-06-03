import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
console.log('API KEY length:', API_KEY.length);

const genAI = new GoogleGenerativeAI(API_KEY);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Hello');
    console.log('Success:', result.response.text());
  } catch (e) {
    console.error('Test failed:', e);
  }
}

test();
