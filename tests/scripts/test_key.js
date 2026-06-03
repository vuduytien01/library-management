const fetch = require("node-fetch");

async function testKey() {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) {
    throw new Error("Missing EXPO_PUBLIC_GEMINI_API_KEY");
  }
  const text = "Hello world";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    },
  );

  if (res.ok) {
    const data = await res.json();
    console.log(
      "SUCCESS! Embedding values length:",
      data.embedding.values.length,
    );
  } else {
    const err = await res.text();
    console.error("FAILED!", res.status, err);
  }
}

testKey();
