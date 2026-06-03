import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
  try {
    // There is no direct listModels in the SDK easily available like this, 
    // but we can try to fetch from the raw endpoint if we want.
    // Actually, the SDK has it? Let's check.
    // @ts-ignore
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('List models failed:', e);
  }
}

listModels();
