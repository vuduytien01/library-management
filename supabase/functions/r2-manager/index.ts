import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { S3Client } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

function normalizeMatchText(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getFirecrawlApiKey(supabaseAdmin?: any) {
  const envKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (envKey) return envKey;

  if (!supabaseAdmin) return "";

  try {
    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("app_secrets")
      .select("value")
      .eq("name", "FIRECRAWL_API_KEY")
      .single();
    if (error) throw error;
    return typeof data?.value === "string" ? data.value : "";
  } catch (error) {
    console.error("Firecrawl secret lookup failed:", error);
    return "";
  }
}

async function extractFirecrawlBookMetadata(
  title: string,
  author = "",
  supabaseAdmin?: any,
) {
  const FIRECRAWL_API_KEY = await getFirecrawlApiKey(supabaseAdmin);
  if (!FIRECRAWL_API_KEY || !title.trim()) return null;

  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      title_en: { type: "string" },
      author: { type: "string" },
      description: { type: "string" },
      cover_url: { type: "string" },
      isbn: { type: "string" },
      categories: { type: "array", items: { type: "string" } },
      evidence_url: { type: "string" },
    },
  };

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls: [
          "https://openlibrary.org/search",
          "https://books.google.com",
        ],
        enable_web_search: true,
        prompt:
          `Find the exact book metadata for Vietnamese audiobook title "${title}"` +
          `${author ? ` by or related to "${author}"` : ""}. ` +
          "Return the English title when available, canonical author, cover image URL, ISBN, categories, and evidence URL. Prefer Google Books or OpenLibrary.",
        schema,
      }),
    });
    if (!response.ok) return null;
    let body = await response.json();
    if (body?.id && !body?.data && !body?.extract) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const status = await fetch(
          `https://api.firecrawl.dev/v1/extract/${body.id}`,
          {
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            },
          },
        );
        if (!status.ok) break;
        body = await status.json();
        if (body?.data || body?.extract || body?.status === "completed") {
          break;
        }
      }
    }
    const data = body?.data || body?.extract || body;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (error) {
    console.error("Firecrawl metadata extraction failed:", error);
    return null;
  }
}

const R2_PUBLIC_URL =
  Deno.env.get("R2_PUBLIC_URL") ??
  "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev";
const BULK_IMPORT_CHUNK_SIZE = 250;
const BULK_IMPORT_CONCURRENCY = 4;
const R2_EXISTING_LOOKUP_CHUNK_SIZE = 500;
const BULK_IMPORT_MAX_RETURNED = 100;

type R2Config = {
  endPoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
};

type R2AudioObject = {
  key: string;
  size?: number;
  lastModified?: unknown;
};

function buildR2PublicUrl(path: string): string {
  return `${R2_PUBLIC_URL}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function extractR2KeyFromUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !url.hostname.includes("r2.dev") &&
      !url.hostname.includes("workers.dev")
    ) {
      return null;
    }
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

function normalizeR2KeyForMatch(value?: string | null): string {
  let key = String(value || "").trim();
  if (!key) return "";

  try {
    key = decodeURIComponent(key);
  } catch {
    // Keep raw non-encoded keys.
  }

  return key
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .normalize("NFC")
    .toLowerCase();
}

function normalizeR2FolderForMatch(value?: string | null): string {
  const key = normalizeR2KeyForMatch(value);
  if (!key) return "";
  return key.endsWith("/") ? key : `${key}/`;
}

function addParentFolders(folders: Set<string>, key: string) {
  const normalized = normalizeR2KeyForMatch(key);
  if (!normalized) return;

  if (normalized.endsWith("/")) {
    folders.add(normalized);
    return;
  }

  const parts = normalized.split("/").filter(Boolean);
  parts.pop();
  let current = "";
  parts.forEach((part) => {
    current += `${part}/`;
    folders.add(current);
  });
}

function collectImportedKeys(records: any[]) {
  const importedKeys = new Set<string>();
  const importedFolders = new Set<string>();
  const byKey = new Map<string, any>();

  records.forEach((record) => {
    const recordKeys: string[] = [];
    if (record.r2_key_normalized) {
      recordKeys.push(String(record.r2_key_normalized));
    }

    if (record.source_platform === "r2" && record.source_id) {
      recordKeys.push(String(record.source_id));
    }

    const fromUrl = extractR2KeyFromUrl(record.source_url);
    if (fromUrl) recordKeys.push(fromUrl);

    if (Array.isArray(record.tags)) {
      record.tags.forEach((tag: unknown) => {
        if (typeof tag === "string" && tag.startsWith("r2_path:")) {
          recordKeys.push(tag.replace("r2_path:", ""));
        }
      });
    }

    recordKeys.filter(Boolean).forEach((key) => {
      const normalizedKey = normalizeR2KeyForMatch(key);
      if (!normalizedKey) return;
      importedKeys.add(normalizedKey);
      if (!byKey.has(normalizedKey)) byKey.set(normalizedKey, record);
    });
  });

  importedKeys.forEach((key) => addParentFolders(importedFolders, key));
  return { importedKeys, importedFolders, byKey };
}

function titleFromR2Path(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const titlePart =
    parts.length > 1 ? parts[parts.length - 2] : parts[0] || path;
  return titlePart
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function cleanStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanString(item))
      .filter((item): item is string => !!item);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function cleanInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildAudiobookImportPayload(
  path: string,
  input: Record<string, unknown>,
) {
  const sourceId = cleanString(input.source_id) || path;
  const sourceUrl = cleanString(input.source_url) || buildR2PublicUrl(sourceId);
  const title =
    cleanString(input.title) ||
    cleanString(input.title_vi) ||
    cleanString(input.title_en) ||
    titleFromR2Path(sourceId) ||
    sourceId.split("/").pop() ||
    "R2 Audiobook";
  const titleVi = cleanString(input.title_vi) || title;
  const author =
    cleanString(input.author) ||
    cleanString(input.author_vi) ||
    cleanString(input.author_en);

  return {
    source_platform: "r2",
    source_id: sourceId,
    source_url: sourceUrl,
    r2_key_normalized: normalizeR2KeyForMatch(sourceId),
    title,
    title_vi: titleVi,
    title_en: cleanString(input.title_en),
    author,
    author_vi: cleanString(input.author_vi) || author,
    author_en: cleanString(input.author_en) || author,
    narrator: cleanString(input.narrator),
    narrator_vi: cleanString(input.narrator_vi) || cleanString(input.narrator),
    narrator_en: cleanString(input.narrator_en) || cleanString(input.narrator),
    description:
      cleanString(input.description) ||
      cleanString(input.description_vi) ||
      cleanString(input.description_en),
    description_vi:
      cleanString(input.description_vi) || cleanString(input.description),
    description_en: cleanString(input.description_en),
    publisher: cleanString(input.publisher),
    isbn: cleanString(input.isbn),
    language: cleanString(input.language) || "vi",
    cover_url: upgradeImageUrl(
      cleanString(input.cover_url) || cleanString(input.thumbnail),
    ),
    duration_seconds: cleanInteger(input.duration_seconds),
    categories: cleanStringArray(input.categories),
    tags: Array.from(
      new Set(["r2_path:" + sourceId, ...cleanStringArray(input.tags)]),
    ),
    is_free: input.is_free === false ? false : true,
    published_at: cleanString(input.published_at),
    scraped_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function getR2Config(): R2Config {
  return {
    endPoint: Deno.env.get("R2_ENDPOINT") ?? "",
    accessKey: Deno.env.get("R2_ACCESS_KEY_ID") ?? "",
    secretKey: Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "",
    bucket: Deno.env.get("R2_BUCKET_NAME") ?? "",
    region: "auto",
  };
}

function assertR2Config(r2Config: R2Config) {
  if (
    !r2Config.accessKey ||
    !r2Config.secretKey ||
    !r2Config.endPoint ||
    !r2Config.bucket
  ) {
    throw new Error(
      "R2 configuration missing in environment variables (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME)",
    );
  }
}

function createR2Client(r2Config: R2Config) {
  assertR2Config(r2Config);
  return new S3Client({
    endPoint: r2Config.endPoint.replace("https://", ""),
    accessKey: r2Config.accessKey,
    secretKey: r2Config.secretKey,
    region: r2Config.region,
    bucket: r2Config.bucket,
    useSSL: true,
    pathStyle: true,
  });
}

function isAudioKey(key: string): boolean {
  return /\.(mp3|m4a|wav)$/i.test(key);
}

async function listR2AudioObjects(
  s3Client: S3Client,
  prefix = "",
  recursive = false,
): Promise<{ objects: R2AudioObject[]; folders: Set<string> }> {
  const objects: R2AudioObject[] = [];
  const folders = new Set<string>();

  for await (const obj of s3Client.listObjects({ prefix })) {
    const relativePath = prefix ? obj.key.replace(prefix, "") : obj.key;
    if (!relativePath) continue;

    if (!recursive && relativePath.includes("/")) {
      const folderName = relativePath.split("/")[0];
      folders.add(prefix ? `${prefix}${folderName}/` : `${folderName}/`);
      continue;
    }

    if (isAudioKey(obj.key)) {
      objects.push({
        key: obj.key,
        size: obj.size,
        lastModified: obj.lastModified,
      });
    }
  }

  return { objects, folders };
}

function uniquePaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  return Array.from(
    new Set(
      paths
        .map((item) => cleanString(item))
        .filter((item): item is string => !!item && isAudioKey(item)),
    ),
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );
  return results;
}

async function fetchExistingR2RecordsByKeys(
  supabaseAdmin: any,
  keys: string[],
) {
  const normalizedKeys = Array.from(
    new Set(keys.map((key) => normalizeR2KeyForMatch(key)).filter(Boolean)),
  );
  if (normalizedKeys.length === 0) return [];

  const results = await mapWithConcurrency(
    chunk(normalizedKeys, R2_EXISTING_LOOKUP_CHUNK_SIZE),
    BULK_IMPORT_CONCURRENCY,
    async (keysChunk) => {
      const { data, error } = await supabaseAdmin
        .from("audiobook_metadata")
        .select(
          "id, title, source_platform, source_id, source_url, tags, r2_key_normalized",
        )
        .in("r2_key_normalized", keysChunk);

      if (error) throw error;
      return data || [];
    },
  );

  return results.flat();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SERVICE_ROLE_KEY") ??
      "";
    const supabaseAdmin = serviceRoleKey
      ? createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey)
      : supabaseClient;

    // 1. Verify Super Admin
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_super_admin) {
      return jsonResponse({ error: "Forbidden: Super Admin only" });
    }

    const { action, path, prefix, payload } = await req.json();

    if (action === "list") {
      const s3Client = createR2Client(getR2Config());
      const { objects, folders } = await listR2AudioObjects(
        s3Client,
        prefix || "",
        false,
      );

      const { data: existing } = await supabaseAdmin
        .from("audiobook_metadata")
        .select(
          "source_platform, source_id, source_url, tags, r2_key_normalized",
        );

      const { importedKeys, importedFolders } = collectImportedKeys(
        existing || [],
      );

      return jsonResponse({
        success: true,
        files: objects.map((o) => ({
          ...o,
          isImported:
            importedKeys.has(normalizeR2KeyForMatch(o.key)) ||
            importedFolders.has(
              normalizeR2FolderForMatch(
                o.key.split("/").slice(0, -1).join("/"),
              ),
            ),
        })),
        folders: Array.from(folders).map((f) => ({
          key: f,
          isImported:
            importedKeys.has(normalizeR2FolderForMatch(f)) ||
            importedFolders.has(normalizeR2FolderForMatch(f)),
        })),
      });
    }

    if (action === "get-metadata") {
      if (!path) throw new Error("Path is required");

      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      const GOOGLE_BOOKS_API_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY");

      // Use Gemini to parse path
      const filename = path.split("/").pop() || path;
      let suggestedTitle = filename
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ");
      let suggestedAuthor = "";

      if (GEMINI_API_KEY) {
        try {
          const prompt = `Analyze the following file path of an audiobook and extract the Title and Author.
          Path: "${path}"
          Return as JSON: {"title": "...", "author": "..."}
          Only return raw JSON, no markdown.`;

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            },
          );
          const geminiData = await geminiRes.json();
          const text =
            geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
          suggestedTitle = parsed.title || suggestedTitle;
          suggestedAuthor = parsed.author || "";
        } catch (e) {
          console.error("Gemini metadata extraction failed:", e);
        }
      }

      // Search Google Books
      let googleMetadata = null;
      try {
        const query = encodeURIComponent(
          `intitle:${suggestedTitle}${suggestedAuthor ? `+inauthor:${suggestedAuthor}` : ""}`,
        );
        const gRes = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1${GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : ""}`,
        );
        const gData = await gRes.json();
        googleMetadata = gData.items?.[0]?.volumeInfo || null;
      } catch (e) {
        console.error("Google Books enrichment failed:", e);
      }

      const firecrawlMetadata = await extractFirecrawlBookMetadata(
        suggestedTitle,
        suggestedAuthor,
        supabaseAdmin,
      );
      const firecrawlTitle = String(
        firecrawlMetadata?.title_en || firecrawlMetadata?.title || "",
      );
      const suggestedTitleNorm = normalizeMatchText(suggestedTitle);
      const firecrawlTitleLooksUseful =
        firecrawlTitle &&
        normalizeMatchText(firecrawlTitle) !== suggestedTitleNorm;

      return jsonResponse({
        success: true,
        suggested: {
          title: suggestedTitle,
          title_en:
            firecrawlMetadata?.title_en ||
            (firecrawlTitleLooksUseful ? firecrawlTitle : "") ||
            googleMetadata?.title ||
            "",
          author:
            firecrawlMetadata?.author ||
            googleMetadata?.authors?.join(", ") ||
            suggestedAuthor,
          description:
            firecrawlMetadata?.description || googleMetadata?.description || "",
          cover_url:
            upgradeImageUrl(
              firecrawlMetadata?.cover_url ||
                googleMetadata?.imageLinks?.thumbnail ||
                googleMetadata?.imageLinks?.smallThumbnail ||
                null,
            ) || "",
          isbn:
            firecrawlMetadata?.isbn ||
            googleMetadata?.industryIdentifiers?.find(
              (i: any) => i.type === "ISBN_13",
            )?.identifier || "",
          categories:
            firecrawlMetadata?.categories || googleMetadata?.categories || [],
          evidence_url: firecrawlMetadata?.evidence_url || "",
        },
      });
    }

    if (action === "import-audiobook") {
      if (!path) throw new Error("Path is required");

      const existing = await fetchExistingR2RecordsByKeys(supabaseAdmin, [
        String(path),
      ]);
      const { byKey } = collectImportedKeys(existing || []);
      const alreadyImported = byKey.get(normalizeR2KeyForMatch(String(path)));
      if (alreadyImported) {
        return jsonResponse({
          success: true,
          alreadyImported: true,
          audiobook: alreadyImported,
        });
      }

      const importPayload = buildAudiobookImportPayload(
        String(path),
        typeof payload === "object" && payload ? payload : {},
      );

      const { data: saved, error: saveError } = await supabaseAdmin
        .from("audiobook_metadata")
        .upsert([importPayload], {
          onConflict: "source_platform,source_id",
        })
        .select()
        .single();

      if (saveError) throw saveError;

      return jsonResponse({
        success: true,
        audiobook: saved,
      });
    }

    if (action === "bulk-import-audiobooks") {
      const requestedPaths = uniquePaths(payload?.paths);
      const requestedPrefix =
        cleanString(payload?.prefix) || cleanString(prefix) || "";
      const recursive = payload?.recursive !== false;
      const s3Client = requestedPaths.length
        ? null
        : createR2Client(getR2Config());
      const listed = s3Client
        ? await listR2AudioObjects(s3Client, requestedPrefix, recursive)
        : {
            objects: requestedPaths.map((key) => ({ key })),
            folders: new Set<string>(),
          };
      const objects = listed.objects;
      const existing = await fetchExistingR2RecordsByKeys(
        supabaseAdmin,
        objects.map((object) => object.key),
      );
      const { importedKeys, byKey } = collectImportedKeys(existing || []);
      const skippedRows = objects.filter((object) =>
        importedKeys.has(normalizeR2KeyForMatch(object.key)),
      );
      const newObjects = objects.filter(
        (object) => !importedKeys.has(normalizeR2KeyForMatch(object.key)),
      );
      const now = new Date().toISOString();
      const rows = newObjects.map((object) => ({
        ...buildAudiobookImportPayload(object.key, {
          ...(typeof payload?.defaults === "object" && payload.defaults
            ? payload.defaults
            : {}),
          source_id: object.key,
          source_url: buildR2PublicUrl(object.key),
        }),
        scraped_at: now,
        updated_at: now,
      }));

      const savedRows: unknown[] = [];
      const failed: Array<{ path: string; error: string }> = [];

      await mapWithConcurrency(
        chunk(rows, BULK_IMPORT_CHUNK_SIZE),
        BULK_IMPORT_CONCURRENCY,
        async (rowsChunk) => {
          const { data: saved, error } = await supabaseAdmin
            .from("audiobook_metadata")
            .upsert(rowsChunk, {
              onConflict: "source_platform,source_id",
            })
            .select();

          if (!error) {
            savedRows.push(...(saved || []));
            return;
          }

          for (const row of rowsChunk) {
            const { data: savedOne, error: oneError } = await supabaseAdmin
              .from("audiobook_metadata")
              .upsert([row], {
                onConflict: "source_platform,source_id",
              })
              .select()
              .single();

            if (oneError) {
              failed.push({
                path: row.source_id,
                error: oneError.message,
              });
            } else if (savedOne) {
              savedRows.push(savedOne);
            }
          }
        },
      );

      return jsonResponse({
        success: failed.length === 0,
        imported: savedRows.length + skippedRows.length,
        created: savedRows.length,
        skipped: skippedRows.length,
        failed: failed.length,
        total: objects.length,
        failures: failed.slice(0, 50),
        audiobooks: [
          ...skippedRows
            .map((object) => byKey.get(normalizeR2KeyForMatch(object.key)))
            .filter((record) => !!record),
          ...savedRows,
        ].slice(0, BULK_IMPORT_MAX_RETURNED),
      });
    }

    throw new Error("Invalid action");
  } catch (err: any) {
    return jsonResponse({ error: err.message || "R2 manager failed" });
  }
});
