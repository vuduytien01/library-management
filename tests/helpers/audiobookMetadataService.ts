import axios from "axios";
import { supabase } from "../../src/api/supabase";

export async function fetchAudiobookFromOpenLibrary(isbn: string) {
  try {
    const response = await axios.get(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      { timeout: 5000 },
    );
    const book = response.data?.[`ISBN:${isbn}`];
    if (!book) return null;

    return {
      title: book.title,
      author: book.authors?.map((author: any) => author.name).join(", "),
      publisher: book.publishers?.[0]?.name,
      cover_url: book.cover?.large || book.cover?.medium || book.cover?.small,
      published_at: book.publish_date,
      description:
        typeof book.description === "string"
          ? book.description
          : book.description?.value,
    };
  } catch {
    throw new Error("OpenLibrary API failure");
  }
}

export async function searchAudiobooks(query: string, limit = 20) {
  const { data, error } = await supabase.rpc("search_audiobooks", {
    query,
    lim: limit,
  });
  if (error || !data) return [];
  return data;
}

export async function browseAudiobooks({
  platform,
  page = 1,
  pageSize = 20,
}: {
  platform?: string;
  page?: number;
  pageSize?: number;
}) {
  let request = supabase
    .from("audiobook_metadata")
    .select("*", { count: "exact" })
    .order("scraped_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (platform) request = request.eq("source_platform", platform);

  const { data, count, error } = await (request as any);
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}
