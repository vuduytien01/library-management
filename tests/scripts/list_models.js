const fetch = require("node-fetch");

async function listModels() {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) {
    throw new Error("Missing EXPO_PUBLIC_GEMINI_API_KEY");
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
  );
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

listModels();
