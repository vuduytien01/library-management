// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function upgradeImageUrl(url: string | null): string | null {
  if (!url) return null;
  let upgraded = url.replace("http://", "https://");
  if (
    upgraded.includes("books.google.com/books/content") ||
    upgraded.includes("google.com/books/content")
  ) {
    upgraded = upgraded
      .replace(/&edge=curl/g, "")
      .replace(/&printsec=frontcover/g, "")
      .replace(/&imgtk=[A-Za-z0-9_-]+/g, "");
    if (upgraded.includes("zoom=")) {
      upgraded = upgraded.replace(/zoom=\d+/g, "zoom=0");
    } else {
      upgraded += `${upgraded.includes("?") ? "&" : "?"}zoom=0`;
    }
    if (!upgraded.includes("fife") && !/[?&]w=/.test(upgraded)) {
      upgraded += "&w=1200";
    }
  } else if (upgraded.includes("covers.openlibrary.org")) {
    upgraded = upgraded.replace("-S.jpg", "-L.jpg").replace("-M.jpg", "-L.jpg");
  }
  return upgraded;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, author } = await req.json();
    // @ts-ignore
    const GOOGLE_BOOKS_API_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY");

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanTitle = encodeURIComponent(title);
    const cleanAuthor = author ? encodeURIComponent(author) : "";
    const query = `intitle:${cleanTitle}${cleanAuthor ? `+inauthor:${cleanAuthor}` : ""}`;

    let googleMetadata = null;
    try {
      const gRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1${GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : ""}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (gRes.ok) {
        const gData = await gRes.json();
        googleMetadata = gData.items?.[0]?.volumeInfo || null;
      }
    } catch (e: any) {
      console.error("Google Books search failed:", e.message);
    }

    if (!googleMetadata) {
      return new Response(JSON.stringify({ error: "No metadata found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawThumbnail =
      googleMetadata.imageLinks?.thumbnail ||
      googleMetadata.imageLinks?.smallThumbnail;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          title: googleMetadata.title,
          author: googleMetadata.authors?.join(", "),
          description: googleMetadata.description,
          thumbnail: upgradeImageUrl(rawThumbnail),
          categories: googleMetadata.categories || [],
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Search metadata error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
