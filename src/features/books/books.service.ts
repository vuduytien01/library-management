import axios from "axios";
import { supabase } from "../../api/supabase";
import { ai } from "../../core/ai";
import { normalizeCoverUrl } from "../../core/mediaAssets";
import { useAuthStore } from "../../store/useAuthStore";
import {
  AudiobookRecord,
  Book,
  BookMetadata,
  EnrichedAudiobook,
} from "./books.types";

type MetadataPayload = Record<string, any>;
type R2ListedObject = {
  key: string;
  size?: number;
  uploaded?: string;
  lastModified?: string;
};
export type R2ImportProgress = {
  processed: number;
  total: number;
  percent: number;
  stage: "listing" | "checking" | "saving" | "fallback" | "done";
};

const R2_PUBLIC_URL = "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev";
const R2_WORKER_URL = "https://r2-audio-worker.vuduytien20042004.workers.dev";
const R2_EDGE_TIMEOUT_MS = 3500;
const R2_LIST_TIMEOUT_MS = 8000;
const R2_IMPORTED_KEYS_TIMEOUT_MS = 8000;
const R2_IMPORTED_KEYS_CACHE_MS = 30000;
const R2_METADATA_FALLBACK_TIMEOUT_MS = 8000;
const R2_METADATA_ENRICH_TIMEOUT_MS = 20000;
const R2_QUICK_IMPORT_TIMEOUT_MS = 8000;
const R2_BULK_IMPORT_CHUNK_SIZE = 250;
const R2_BULK_IMPORT_CONCURRENCY = 4;
const R2_EXISTING_LOOKUP_CHUNK_SIZE = 500;
const R2_BULK_IMPORT_MAX_RETURNED = 100;

type CanonicalBookRecord = Pick<
  Book,
  | "isbn"
  | "title"
  | "author"
  | "description"
  | "cover_url"
  | "category"
  | "title_en"
  | "title_vi"
  | "description_en"
  | "description_vi"
>;

const normalizeMatchText = (value?: string | null): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugToTitle = (value?: string | null): string =>
  String(value || "").replace(/[-_]+/g, " ");

const isAudioR2Key = (key?: string | null): boolean =>
  /\.(mp3|m4a|wav)$/i.test(String(key || ""));

const buildR2PublicUrl = (key: string): string =>
  `${R2_PUBLIC_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;

const titleFromR2Path = (key: string): string => {
  const parts = key.split("/").filter(Boolean);
  const titlePart =
    parts.length > 1 ? parts[parts.length - 2] : parts[0] || key;
  return titlePart
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const getKnownAudiobookMetadata = (
  titleOrPath?: string | null,
): Partial<BookMetadata> | null => {
  const title = titleFromR2Path(String(titleOrPath || ""));
  const normalized = normalizeMatchText(title);
  const known: Record<string, Partial<BookMetadata>> = {
    "duong xua may trang": {
      title: "Old Path White Clouds",
      title_vi: "Đường Xưa Mây Trắng",
      title_en: "Old Path White Clouds",
      author: "Thích Nhất Hạnh",
      author_vi: "Thích Nhất Hạnh",
      author_en: "Thich Nhat Hanh",
      thumbnail: "https://covers.openlibrary.org/b/id/715886-L.jpg",
      language: "vi",
      categories: ["Religion", "Buddhism"],
    },
    "hanh trinh ve phuong dong": {
      title: "Journey to the East",
      title_vi: "Hành trình về phương Đông",
      title_en: "Journey to the East",
      author: "Baird T. Spalding",
      author_vi: "Baird T. Spalding",
      author_en: "Baird T. Spalding",
      thumbnail:
        "https://books.google.com/books/content?id=4RrtDwAAQBAJ&printsec=frontcover&img=1&zoom=0&source=gbs_api",
      language: "vi",
      categories: ["Spirituality"],
    },
    "chu nghia khac ky": {
      title: "A Guide to the Good Life: The Ancient Art of Stoic Joy",
      title_vi: "Chủ nghĩa khắc kỷ",
      title_en: "A Guide to the Good Life: The Ancient Art of Stoic Joy",
      author: "William B. Irvine",
      author_vi: "William B. Irvine",
      author_en: "William B. Irvine",
      thumbnail: "https://covers.openlibrary.org/b/isbn/9780195374612-L.jpg",
      isbn: "9780195374612",
      language: "vi",
      categories: ["Philosophy", "Stoicism"],
    },
  };

  return known[normalized] || null;
};

const extractR2KeyFromUrl = (value?: string | null): string | null => {
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
};

const normalizeR2KeyForMatch = (value?: string | null): string => {
  let key = String(value || "").trim();
  if (!key) return "";

  try {
    key = decodeURIComponent(key);
  } catch {
    // Keep the raw key when it is not percent-encoded.
  }

  return key
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .normalize("NFC")
    .toLowerCase();
};

const normalizeR2FolderForMatch = (value?: string | null): string => {
  const key = normalizeR2KeyForMatch(value);
  if (!key) return "";
  return key.endsWith("/") ? key : `${key}/`;
};

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
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
};

const uniqueAudioPaths = (paths?: string[] | null): string[] =>
  Array.from(
    new Set(
      (Array.isArray(paths) ? paths : [])
        .map((path) => String(path || "").trim())
        .filter((path) => path && isAudioR2Key(path)),
    ),
  );

type R2ImportIndex = {
  keys: Set<string>;
  folders: Set<string>;
};

let importedR2IndexCache: {
  expiresAt: number;
  value: R2ImportIndex;
} | null = null;
let importedR2IndexPromise: Promise<R2ImportIndex> | null = null;
const canUseImportedR2IndexCache = () => process.env.NODE_ENV !== "test";

const addImportedR2Key = (imported: Set<string>, key?: string | null) => {
  const normalized = normalizeR2KeyForMatch(key);
  if (normalized) imported.add(normalized);
};

const addImportedR2Folder = (folders: Set<string>, key?: string | null) => {
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
};

const loadImportedR2Index = async (): Promise<R2ImportIndex> => {
  if (
    canUseImportedR2IndexCache() &&
    importedR2IndexCache &&
    importedR2IndexCache.expiresAt > Date.now()
  ) {
    return importedR2IndexCache.value;
  }

  if (canUseImportedR2IndexCache() && importedR2IndexPromise) {
    return importedR2IndexPromise;
  }

  importedR2IndexPromise = (async () => {
    const imported = new Set<string>();
    const result = await withTimeout<{ data?: any[] }>(
      supabase
        .from("audiobook_metadata")
        .select(
          "source_platform, source_id, source_url, tags, r2_key_normalized",
        )
        .or(
          "source_platform.eq.r2,source_url.ilike.%r2.dev%,source_url.ilike.%workers.dev%,r2_key_normalized.not.is.null",
        ) as any,
      R2_IMPORTED_KEYS_TIMEOUT_MS,
      "R2 imported-key lookup timed out",
    );
    const data = result?.data || [];

    data.forEach((item: any) => {
      addImportedR2Key(imported, item.r2_key_normalized);

      if (item.source_platform === "r2" && item.source_id) {
        addImportedR2Key(imported, item.source_id);
      }

      const fromUrl = extractR2KeyFromUrl(item.source_url);
      addImportedR2Key(imported, fromUrl);

      if (Array.isArray(item.tags)) {
        item.tags.forEach((tag: unknown) => {
          if (typeof tag === "string" && tag.startsWith("r2_path:")) {
            addImportedR2Key(imported, tag.replace("r2_path:", ""));
          }
        });
      }
    });

    const folders = new Set<string>();
    imported.forEach((key) => addImportedR2Folder(folders, key));

    const value = { keys: imported, folders };
    if (canUseImportedR2IndexCache()) {
      importedR2IndexCache = {
        expiresAt: Date.now() + R2_IMPORTED_KEYS_CACHE_MS,
        value,
      };
    }
    return value;
  })();

  try {
    return await importedR2IndexPromise;
  } finally {
    importedR2IndexPromise = null;
  }
};

const invalidateImportedR2IndexCache = () => {
  importedR2IndexCache = null;
};

const rememberImportedR2Key = (key?: string | null) => {
  if (!importedR2IndexCache?.value) return;
  const normalized = normalizeR2KeyForMatch(key);
  if (!normalized) return;

  importedR2IndexCache.value.keys.add(normalized);
  addImportedR2Folder(importedR2IndexCache.value.folders, normalized);
};

const applyImportedR2State = async (items: {
  files: any[];
  folders: any[];
}): Promise<{ files: any[]; folders: any[] }> => {
  let importedIndex: R2ImportIndex = { keys: new Set(), folders: new Set() };
  try {
    importedIndex = await loadImportedR2Index();
  } catch (error) {
    console.warn("[booksService] R2 imported-key lookup skipped:", error);
    return items;
  }

  return {
    files: items.files.map((file) => {
      const fileKey = normalizeR2KeyForMatch(file.key);
      const parentFolder = normalizeR2FolderForMatch(
        fileKey.split("/").slice(0, -1).join("/"),
      );
      return {
        ...file,
        isImported:
          file.isImported ||
          importedIndex.keys.has(fileKey) ||
          importedIndex.folders.has(parentFolder),
      };
    }),
    folders: items.folders.map((folder) => {
      const folderKey = normalizeR2FolderForMatch(folder.key);
      return {
        ...folder,
        isImported:
          folder.isImported ||
          importedIndex.keys.has(folderKey) ||
          importedIndex.folders.has(folderKey),
      };
    }),
  };
};

const getR2PathsForBulkImport = async (options: {
  prefix?: string;
  paths?: string[];
  recursive?: boolean;
}): Promise<string[]> => {
  const requestedPaths = uniqueAudioPaths(options.paths);
  if (Array.isArray(options.paths)) return requestedPaths;

  const prefix = options.prefix || "";
  const response = await axios.get<R2ListedObject[]>(`${R2_WORKER_URL}/_list`, {
    timeout: 15000,
  });
  const allObjects = Array.isArray(response.data) ? response.data : [];
  return uniqueAudioPaths(
    allObjects
      .map((object) => object?.key)
      .filter(
        (key): key is string =>
          !!key &&
          key.startsWith(prefix) &&
          isAudioR2Key(key) &&
          (options.recursive !== false ||
            !key.slice(prefix.length).includes("/")),
      ),
  );
};

const notifyR2ImportProgress = (
  onProgress: ((progress: R2ImportProgress) => void) | undefined,
  progress: R2ImportProgress,
) => {
  if (!onProgress) return;
  onProgress({
    ...progress,
    percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
  });
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const fetchExistingR2RecordsByKeys = async (paths: string[]) => {
  const normalizedKeys = Array.from(
    new Set(paths.map((path) => normalizeR2KeyForMatch(path)).filter(Boolean)),
  );
  if (normalizedKeys.length === 0) return [];

  const results = await mapWithConcurrency(
    chunk(normalizedKeys, R2_EXISTING_LOOKUP_CHUNK_SIZE),
    R2_BULK_IMPORT_CONCURRENCY,
    async (keysChunk) => {
      const { data, error } = await supabase
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
};

const collectImportedR2Records = (records: any[]) => {
  const importedKeys = new Set<string>();
  const byKey = new Map<string, any>();

  records.forEach((record) => {
    const candidateKeys = [
      record?.r2_key_normalized,
      record?.source_platform === "r2" ? record?.source_id : null,
      extractR2KeyFromUrl(record?.source_url),
      ...(Array.isArray(record?.tags)
        ? record.tags
            .filter(
              (tag: unknown) =>
                typeof tag === "string" && tag.startsWith("r2_path:"),
            )
            .map((tag: string) => tag.replace("r2_path:", ""))
        : []),
    ];

    candidateKeys.forEach((key) => {
      const normalizedKey = normalizeR2KeyForMatch(key);
      if (!normalizedKey) return;
      importedKeys.add(normalizedKey);
      if (!byKey.has(normalizedKey)) byKey.set(normalizedKey, record);
    });
  });

  return { importedKeys, byKey };
};

const buildR2QuickImportPayload = (path: string) => {
  const title =
    titleFromR2Path(path) || path.split("/").pop() || "R2 Audiobook";
  const known = getKnownAudiobookMetadata(title);
  const now = new Date().toISOString();
  return {
    source_platform: "r2",
    source_id: path,
    source_url: buildR2PublicUrl(path),
    r2_key_normalized: normalizeR2KeyForMatch(path),
    title,
    title_vi: known?.title_vi || title,
    title_en: known?.title_en || null,
    author: known?.author || null,
    author_vi: known?.author_vi || known?.author || null,
    author_en: known?.author_en || known?.author || null,
    narrator: null,
    narrator_vi: null,
    narrator_en: null,
    description: known?.description || null,
    description_vi: known?.description_vi || known?.description || null,
    description_en: known?.description_en || null,
    publisher: null,
    isbn: null,
    language: "vi",
    cover_url: normalizeCoverUrl(known?.thumbnail) || null,
    duration_seconds: null,
    categories: known?.categories || [],
    tags: [`r2_path:${path}`],
    is_free: true,
    scraped_at: now,
    updated_at: now,
  };
};

const mergeResolvedMetadataIntoR2Payload = (
  path: string,
  metadata?: Partial<BookMetadata> | null,
  seed?: MetadataPayload | null,
) => {
  const base = {
    ...buildR2QuickImportPayload(path),
    ...(seed || {}),
    source_platform: "r2",
    source_id: path,
    source_url: buildR2PublicUrl(path),
    r2_key_normalized: normalizeR2KeyForMatch(path),
    tags: Array.isArray(seed?.tags) ? seed?.tags : [`r2_path:${path}`],
  };
  if (!metadata) return base;

  const titleVi = String(
    metadata.title_vi || base.title_vi || titleFromR2Path(path),
  );
  const metadataTitle = String(metadata.title || "");
  const metadataTitleIsEnglish =
    metadataTitle &&
    normalizeMatchText(metadataTitle) !== normalizeMatchText(titleVi);
  const coverUrl = normalizeCoverUrl(
    (metadata as any).cover_url || metadata.thumbnail || base.cover_url,
  );

  return {
    ...base,
    title: titleVi || base.title,
    title_vi: titleVi || base.title_vi,
    title_en:
      metadata.title_en ||
      (metadataTitleIsEnglish ? metadataTitle : base.title_en) ||
      null,
    author: metadata.author || base.author || null,
    author_vi: metadata.author_vi || metadata.author || base.author_vi || null,
    author_en: metadata.author_en || metadata.author || base.author_en || null,
    description: metadata.description || base.description || null,
    description_vi:
      metadata.description_vi ||
      metadata.description ||
      base.description_vi ||
      null,
    description_en: metadata.description_en || base.description_en || null,
    publisher: metadata.publisher || base.publisher || null,
    isbn: metadata.isbn || base.isbn || null,
    language: metadata.language || base.language || "vi",
    cover_url: coverUrl || null,
    categories: metadata.categories || base.categories || [],
    updated_at: new Date().toISOString(),
  };
};

const pickR2MetadataPatch = (payload: MetadataPayload) => {
  const fields = [
    "title",
    "title_vi",
    "title_en",
    "author",
    "author_vi",
    "author_en",
    "narrator",
    "narrator_vi",
    "narrator_en",
    "description",
    "description_vi",
    "description_en",
    "publisher",
    "isbn",
    "language",
    "cover_url",
    "duration_seconds",
    "categories",
    "tags",
    "source_url",
    "r2_key_normalized",
    "is_free",
    "updated_at",
  ];
  return fields.reduce((patch: MetadataPayload, field) => {
    const value = payload[field];
    if (value === undefined) return patch;
    if (typeof value === "string" && !value.trim()) return patch;
    if (Array.isArray(value) && value.length === 0) return patch;
    patch[field] = value;
    return patch;
  }, {});
};

const importR2AudiobookViaRpc = async (
  path: string,
  payload: Record<string, any>,
) => {
  const { data, error } = await supabase.rpc("import_r2_audiobook", {
    p_path: path,
    p_payload: payload,
  });

  if (error) throw error;
  const record = Array.isArray(data) ? data[0] : data;
  if (!record?.id) {
    throw new Error("R2 import RPC did not return an audiobook record.");
  }

  return {
    success: true,
    imported: 1,
    created: 1,
    skipped: 0,
    failed: 0,
    total: 1,
    failures: [],
    audiobooks: [record],
  };
};

const quickImportR2AudiobookViaRpc = async (path: string) =>
  importR2AudiobookViaRpc(path, buildR2QuickImportPayload(path));

const findR2AudiobookRecordByPath = async (path: string) => {
  const normalizedKey = normalizeR2KeyForMatch(path);
  const sourceUrl = buildR2PublicUrl(path);

  const byKey = await supabase
    .from("audiobook_metadata")
    .select("*")
    .eq("r2_key_normalized", normalizedKey)
    .limit(1);
  if (byKey.error) throw byKey.error;
  if (byKey.data?.[0]) return byKey.data[0];

  const bySource = await supabase
    .from("audiobook_metadata")
    .select("*")
    .eq("source_platform", "r2")
    .eq("source_id", path)
    .limit(1);
  if (bySource.error) throw bySource.error;
  if (bySource.data?.[0]) return bySource.data[0];

  const byUrl = await supabase
    .from("audiobook_metadata")
    .select("*")
    .eq("source_url", sourceUrl)
    .limit(1);
  if (byUrl.error) throw byUrl.error;
  return byUrl.data?.[0] || null;
};

const waitForR2AudiobookRecord = async (path: string) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const record = await findR2AudiobookRecordByPath(path);
    if (record?.id) return record;
    await sleep(400);
  }
  throw new Error(
    "Import finished but the audiobook record was not found in Supabase.",
  );
};

const bulkImportR2AudiobooksLocally = async (options: {
  prefix?: string;
  paths?: string[];
  recursive?: boolean;
  onProgress?: (progress: R2ImportProgress) => void;
}) => {
  notifyR2ImportProgress(options.onProgress, {
    processed: 0,
    total: 0,
    percent: 2,
    stage: "listing",
  });
  const paths = await getR2PathsForBulkImport(options);
  notifyR2ImportProgress(options.onProgress, {
    processed: 0,
    total: paths.length,
    percent: paths.length ? 8 : 100,
    stage: paths.length ? "checking" : "done",
  });
  const existingRecords = await fetchExistingR2RecordsByKeys(paths);
  const { importedKeys, byKey } = collectImportedR2Records(existingRecords);
  const skippedPaths = paths.filter((path) =>
    importedKeys.has(normalizeR2KeyForMatch(path)),
  );
  const newPaths = paths.filter(
    (path) => !importedKeys.has(normalizeR2KeyForMatch(path)),
  );
  const rows = newPaths.map(buildR2QuickImportPayload);
  const savedRows: any[] = [];
  const failures: Array<{ path: string; error: string }> = [];
  let processedCount = skippedPaths.length;

  notifyR2ImportProgress(options.onProgress, {
    processed: processedCount,
    total: paths.length,
    percent: paths.length ? (processedCount / paths.length) * 100 : 100,
    stage: paths.length ? "saving" : "done",
  });

  await mapWithConcurrency(
    chunk(rows, R2_BULK_IMPORT_CHUNK_SIZE),
    R2_BULK_IMPORT_CONCURRENCY,
    async (rowsChunk) => {
      const { data, error } = await supabase
        .from("audiobook_metadata")
        .upsert(rowsChunk, { onConflict: "source_platform,source_id" })
        .select();

      if (!error) {
        savedRows.push(...(data || []));
        processedCount += rowsChunk.length;
        notifyR2ImportProgress(options.onProgress, {
          processed: processedCount,
          total: paths.length,
          percent: paths.length ? (processedCount / paths.length) * 100 : 100,
          stage: processedCount >= paths.length ? "done" : "saving",
        });
        return;
      }

      for (const row of rowsChunk) {
        const { data: savedOne, error: oneError } = await supabase
          .from("audiobook_metadata")
          .upsert([row], { onConflict: "source_platform,source_id" })
          .select()
          .single();

        if (oneError) {
          failures.push({ path: row.source_id, error: oneError.message });
        } else if (savedOne) {
          savedRows.push(savedOne);
        }
      }
      processedCount += rowsChunk.length;
      notifyR2ImportProgress(options.onProgress, {
        processed: processedCount,
        total: paths.length,
        percent: paths.length ? (processedCount / paths.length) * 100 : 100,
        stage: processedCount >= paths.length ? "done" : "saving",
      });
    },
  );

  const skippedRows = skippedPaths
    .map((path) => byKey.get(normalizeR2KeyForMatch(path)))
    .filter(Boolean);

  return {
    success: failures.length === 0,
    imported: savedRows.length + skippedRows.length,
    created: savedRows.length,
    skipped: skippedRows.length,
    failed: failures.length,
    total: paths.length,
    failures: failures.slice(0, 50),
    audiobooks: [...skippedRows, ...savedRows].slice(
      0,
      R2_BULK_IMPORT_MAX_RETURNED,
    ),
  };
};

const listR2ObjectsFromWorker = async (
  prefix = "",
): Promise<{ files: any[]; folders: any[] }> => {
  const response = await axios.get<R2ListedObject[]>(`${R2_WORKER_URL}/_list`, {
    timeout: 15000,
  });
  const allObjects = Array.isArray(response.data) ? response.data : [];
  const folders = new Set<string>();
  const files: any[] = [];

  allObjects.forEach((object) => {
    if (!object?.key || !object.key.startsWith(prefix)) return;

    const relativePath = prefix ? object.key.slice(prefix.length) : object.key;
    if (!relativePath) return;

    if (relativePath.includes("/")) {
      const folderName = relativePath.split("/")[0];
      folders.add(prefix ? `${prefix}${folderName}/` : `${folderName}/`);
      return;
    }

    if (!isAudioR2Key(object.key)) return;

    files.push({
      key: object.key,
      size: object.size,
      lastModified: object.lastModified || object.uploaded,
      isImported: false,
    });
  });

  return applyImportedR2State({
    files,
    folders: Array.from(folders).map((key) => ({
      key,
      isImported: false,
    })),
  });
};

const getMetadataKeys = (...values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => normalizeMatchText(value))
        .filter((value) => value.length >= 3),
    ),
  );

const isDifferentTitle = (
  titleA?: string | null,
  titleB?: string | null,
): boolean =>
  !!titleA &&
  !!titleB &&
  normalizeMatchText(titleA) !== normalizeMatchText(titleB);

const looksLikeEnglishTitle = (value?: string | null): boolean =>
  !!value &&
  /[a-zA-Z]/.test(value) &&
  /^[\x00-\x7F\s.,:'"!?&()[\]\-]+$/.test(value);

const chooseEnglishTitleCandidate = (
  vietnameseTitle: string,
  ...candidates: Array<string | null | undefined>
): string | undefined => {
  const match = candidates.find(
    (candidate) =>
      looksLikeEnglishTitle(candidate) &&
      isDifferentTitle(candidate, vietnameseTitle),
  );
  return match || undefined;
};

const getBookMatchKeys = (book: CanonicalBookRecord) =>
  getMetadataKeys(book.title, book.title_vi, book.title_en);

const getAudiobookMatchKeys = (audiobook: AudiobookRecord) =>
  getMetadataKeys(
    audiobook.title,
    audiobook.title_vi,
    audiobook.title_en,
    slugToTitle(audiobook.source_id),
  );

const findCanonicalBookMatch = (
  audiobook: AudiobookRecord,
  books: CanonicalBookRecord[],
): CanonicalBookRecord | null => {
  const cleanIsbn = audiobook.isbn
    ? String(audiobook.isbn).replace(/[-\s]/g, "")
    : "";
  if (cleanIsbn) {
    const isbnMatch = books.find(
      (book) => String(book.isbn || "").replace(/[-\s]/g, "") === cleanIsbn,
    );
    if (isbnMatch) return isbnMatch;
  }

  const audioKeys = getAudiobookMatchKeys(audiobook);
  if (audioKeys.length === 0) return null;

  for (const book of books) {
    const bookKeys = getBookMatchKeys(book);
    if (
      audioKeys.some((audioKey) =>
        bookKeys.some((bookKey) => audioKey === bookKey),
      )
    ) {
      return book;
    }
  }

  return null;
};

const applyCanonicalAudiobookMetadata = (
  audiobook: MetadataPayload,
  metadata?: Partial<BookMetadata> | null,
  force = false,
) => {
  if (!metadata) return false;

  const before = JSON.stringify({
    title_en: audiobook.title_en,
    author: audiobook.author,
    cover_url: audiobook.cover_url,
  });

  if (force && hasMetadataValue(metadata.title_en || metadata.title)) {
    audiobook.title_en = metadata.title_en || metadata.title;
  } else {
    fillMissing(audiobook, "title_en", metadata.title_en || metadata.title);
  }

  if (force && hasMetadataValue(metadata.author)) {
    audiobook.author = metadata.author;
  } else {
    fillMissing(audiobook, "author", metadata.author);
  }

  const coverUrl = force
    ? normalizeCoverUrl(metadata.thumbnail) ||
      normalizeCoverUrl(audiobook.cover_url)
    : normalizeCoverUrl(audiobook.cover_url) ||
      normalizeCoverUrl(metadata.thumbnail);
  if (coverUrl) audiobook.cover_url = coverUrl;

  return (
    before !==
    JSON.stringify({
      title_en: audiobook.title_en,
      author: audiobook.author,
      cover_url: audiobook.cover_url,
    })
  );
};

const metadataFromBook = (
  book: CanonicalBookRecord,
): Partial<BookMetadata> => ({
  title: book.title_en || book.title,
  title_en: book.title_en || book.title,
  author: book.author || undefined,
  thumbnail: book.cover_url || undefined,
});

const resolveAudiobookEnglishTitle = async (
  audiobook: MetadataPayload,
  canonicalBook?: CanonicalBookRecord | null,
): Promise<string | undefined> => {
  const vietnameseTitle = String(audiobook.title_vi || audiobook.title || "");
  if (!vietnameseTitle) return undefined;
  if (looksLikeEnglishTitle(vietnameseTitle)) return vietnameseTitle;

  const fromBook = canonicalBook
    ? chooseEnglishTitleCandidate(
        vietnameseTitle,
        canonicalBook.title_en,
        canonicalBook.title,
      )
    : undefined;
  if (fromBook) return fromBook;

  const fromAudiobook = chooseEnglishTitleCandidate(
    vietnameseTitle,
    audiobook.title_en,
  );
  if (fromAudiobook) return fromAudiobook;

  return undefined;
};

const hasMetadataValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const fillMissing = (
  payload: MetadataPayload,
  field: string,
  value: unknown,
) => {
  if (!hasMetadataValue(payload[field]) && hasMetadataValue(value)) {
    payload[field] = value;
  }
};

const needsBookMetadataLookup = (payload: MetadataPayload): boolean =>
  !normalizeCoverUrl(payload.cover_url) ||
  !hasMetadataValue(payload.author) ||
  !hasMetadataValue(payload.description) ||
  !hasMetadataValue(payload.category);

const needsAudiobookMetadataLookup = (payload: MetadataPayload): boolean =>
  !normalizeCoverUrl(payload.cover_url) ||
  !hasMetadataValue(payload.author) ||
  !hasMetadataValue(payload.description);

const applyBookMetadata = (
  payload: MetadataPayload,
  metadata?: Partial<BookMetadata> | null,
) => {
  if (!metadata) return;

  fillMissing(payload, "title", metadata.title);
  fillMissing(payload, "author", metadata.author);
  fillMissing(payload, "description", metadata.description);
  fillMissing(payload, "published_date", metadata.publishedDate);
  fillMissing(payload, "page_count", metadata.pageCount);
  fillMissing(payload, "category", metadata.categories?.[0]);
  fillMissing(payload, "language", metadata.language);
  fillMissing(payload, "average_rating", metadata.averageRating);
  fillMissing(payload, "ratings_count", metadata.ratingsCount);
  fillMissing(payload, "edition", metadata.edition);
  fillMissing(payload, "title_en", metadata.title_en);
  fillMissing(payload, "title_vi", metadata.title_vi);
  fillMissing(payload, "description_en", metadata.description_en);
  fillMissing(payload, "description_vi", metadata.description_vi);
  fillMissing(payload, "author_en", metadata.author_en);
  fillMissing(payload, "author_vi", metadata.author_vi);

  const coverUrl =
    normalizeCoverUrl(payload.cover_url) ||
    normalizeCoverUrl(metadata.thumbnail);
  if (coverUrl) payload.cover_url = coverUrl;
};

const applyAudiobookMetadata = (
  payload: MetadataPayload,
  metadata?: Partial<BookMetadata> | null,
) => {
  if (!metadata) return;

  fillMissing(payload, "title", metadata.title);
  fillMissing(payload, "author", metadata.author);
  fillMissing(payload, "description", metadata.description);
  fillMissing(payload, "published_date", metadata.publishedDate);
  fillMissing(payload, "language", metadata.language);
  fillMissing(payload, "categories", metadata.categories);
  fillMissing(payload, "title_en", metadata.title_en);
  fillMissing(payload, "title_vi", metadata.title_vi);
  fillMissing(payload, "description_en", metadata.description_en);
  fillMissing(payload, "description_vi", metadata.description_vi);
  fillMissing(payload, "author_en", metadata.author_en);
  fillMissing(payload, "author_vi", metadata.author_vi);

  const coverUrl =
    normalizeCoverUrl(payload.cover_url) ||
    normalizeCoverUrl(metadata.thumbnail);
  if (coverUrl) payload.cover_url = coverUrl;
};

const invokeR2Manager = async (body: Record<string, unknown>) => {
  const callR2Manager = async (accessToken: string) => {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/r2-manager`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text ? { error: text } : null;
    }

    return { response, payload };
  };

  const storeSession = useAuthStore.getState().session;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const activeSession = session || storeSession;
  const accessToken = activeSession?.access_token;
  if (!accessToken) {
    throw new Error(
      "Phiên đăng nhập đã hết hạn. Vui lòng reload hoặc đăng nhập lại.",
    );
  }

  let { response, payload } = await callR2Manager(accessToken);
  if (
    (response.status === 401 || payload?.error === "Unauthorized") &&
    activeSession?.refresh_token
  ) {
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (!refreshError && refreshedSession?.access_token) {
      await useAuthStore.getState().setSession(refreshedSession);
      ({ response, payload } = await callR2Manager(
        refreshedSession.access_token,
      ));
    }
  }

  if (!response.ok || payload?.error) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `R2 manager failed with status ${response.status}`,
    );
  }

  return payload || {};
};

export const booksService = {
  /**
   * Lists objects (files and folders) from Cloudflare R2 via Edge Function.
   */
  async listR2Objects(
    prefix?: string,
  ): Promise<{ files: any[]; folders: any[] }> {
    try {
      return await withTimeout(
        listR2ObjectsFromWorker(prefix || ""),
        R2_EDGE_TIMEOUT_MS,
        "R2 worker list lookup timed out",
      );
    } catch (workerError) {
      console.warn(
        "[booksService] R2 worker list failed, using edge manager:",
        workerError,
      );
    }

    try {
      const data = await withTimeout(
        invokeR2Manager({ action: "list", prefix: prefix || "" }),
        R2_LIST_TIMEOUT_MS,
        "R2 list lookup timed out",
      );
      return applyImportedR2State({
        files: Array.isArray(data?.files) ? data.files : [],
        folders: Array.isArray(data?.folders) ? data.folders : [],
      });
    } catch (error) {
      console.warn("[booksService] R2 manager list failed:", error);
      throw error;
    }
  },

  /**
   * Extracts and enriches metadata from an R2 path using AI via Edge Function.
   */
  async getR2Metadata(path: string): Promise<any> {
    const title = titleFromR2Path(path);
    const known = getKnownAudiobookMetadata(title);
    if (known) {
      return {
        title,
        title_vi: known.title_vi || title,
        title_en: known.title_en || known.title || "",
        author: known.author || "",
        author_vi: known.author_vi || known.author || "",
        author_en: known.author_en || known.author || "",
        description: known.description || "",
        description_vi: known.description_vi || known.description || "",
        description_en: known.description_en || "",
        cover_url: normalizeCoverUrl(known.thumbnail) || "",
        isbn: known.isbn || "",
        categories: known.categories || [],
        source_url: buildR2PublicUrl(path),
      };
    }

    try {
      const data = await withTimeout(
        invokeR2Manager({ action: "get-metadata", path }),
        R2_EDGE_TIMEOUT_MS,
        "R2 metadata lookup timed out",
      );
      return data?.suggested || {};
    } catch (error) {
      console.warn(
        "[booksService] R2 manager metadata failed, using client lookup:",
        error,
      );
      let metadata: Partial<BookMetadata> | null = null;
      try {
        metadata = await withTimeout(
          this.fetchMetadataBySearch(title, ""),
          R2_METADATA_FALLBACK_TIMEOUT_MS,
          "R2 metadata fallback lookup timed out",
        );
      } catch (fallbackError) {
        console.warn(
          "[booksService] R2 client metadata fallback skipped:",
          fallbackError,
        );
      }
      return {
        title,
        title_vi: title,
        title_en: metadata?.title_en || metadata?.title || "",
        author: metadata?.author || "",
        author_vi: metadata?.author_vi || metadata?.author || "",
        author_en: metadata?.author_en || metadata?.author || "",
        description: metadata?.description || "",
        description_vi: metadata?.description_vi || metadata?.description || "",
        description_en: metadata?.description_en || "",
        cover_url: metadata?.thumbnail || "",
        isbn: metadata?.isbn || "",
        categories: metadata?.categories || [],
        source_url: buildR2PublicUrl(path),
      };
    }
  },

  async resolveR2AudiobookMetadata(
    path: string,
    seed?: MetadataPayload | null,
  ): Promise<MetadataPayload> {
    const title = titleFromR2Path(path);
    const knownMetadata = getKnownAudiobookMetadata(title);
    let resolved = mergeResolvedMetadataIntoR2Payload(
      path,
      knownMetadata,
      seed,
    );

    if (
      !normalizeCoverUrl(resolved.cover_url) ||
      !hasMetadataValue(resolved.author)
    ) {
      try {
        const edgeMetadata = await withTimeout(
          this.getR2Metadata(path),
          R2_METADATA_FALLBACK_TIMEOUT_MS,
          "R2 metadata resolver timed out",
        );
        resolved = mergeResolvedMetadataIntoR2Payload(
          path,
          edgeMetadata,
          resolved,
        );
      } catch (error) {
        console.warn("[booksService] R2 resolver edge metadata failed:", error);
      }
    }

    try {
      resolved = await withTimeout(
        this.enrichAudiobookPayload(resolved),
        R2_METADATA_ENRICH_TIMEOUT_MS,
        "R2 audiobook metadata enrichment timed out",
      );
    } catch (error) {
      console.warn("[booksService] R2 resolver enrichment skipped:", error);
    }

    // Curated R2 metadata is the final source of truth for known audiobooks.
    // Re-apply it after enrichment so stale drafts or canonical rows cannot
    // reintroduce old title/author/cover values.
    if (knownMetadata) {
      resolved = mergeResolvedMetadataIntoR2Payload(
        path,
        knownMetadata,
        resolved,
      );
    }

    return {
      ...resolved,
      source_platform: "r2",
      source_id: path,
      source_url: resolved.source_url || buildR2PublicUrl(path),
      r2_key_normalized: normalizeR2KeyForMatch(path),
      tags: Array.isArray(resolved.tags)
        ? Array.from(new Set([`r2_path:${path}`, ...resolved.tags]))
        : [`r2_path:${path}`],
      skip_metadata_enrichment: true,
    };
  },

  async enrichR2AudiobookRecord(path: string, record?: any | null) {
    const existing = record?.id
      ? record
      : await findR2AudiobookRecordByPath(path);
    if (!existing?.id) return null;

    const resolved = await this.resolveR2AudiobookMetadata(path, existing);
    const patch = pickR2MetadataPatch(resolved);
    if (Object.keys(patch).length === 0) return existing;

    const { data, error } = await supabase
      .from("audiobook_metadata")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data || existing;
  },

  async enrichR2AudiobookRecords(records?: any[] | null) {
    const r2Records = (Array.isArray(records) ? records : []).filter(
      (record) => record?.source_platform === "r2" && record?.source_id,
    );
    await mapWithConcurrency(r2Records, 2, async (record) => {
      try {
        await this.enrichR2AudiobookRecord(record.source_id, record);
      } catch (error) {
        console.warn(
          `[booksService] R2 background metadata failed for ${record.source_id}:`,
          error,
        );
      }
    });
  },

  async importR2Audiobook(path: string, payload: Record<string, any>) {
    try {
      const result = await importR2AudiobookViaRpc(path, payload);
      const audiobook = result.audiobooks[0];
      rememberImportedR2Key(path);
      rememberImportedR2Key(audiobook.source_id);
      return audiobook;
    } catch (rpcError) {
      console.warn(
        "[booksService] R2 import RPC failed, using edge manager:",
        rpcError,
      );
    }

    const data = await invokeR2Manager({
      action: "import-audiobook",
      path,
      payload,
    });

    if (!data?.audiobook) {
      throw new Error("R2 import did not return an audiobook record.");
    }
    rememberImportedR2Key(path);
    rememberImportedR2Key(data.audiobook.source_id);
    return data.audiobook;
  },

  async bulkImportR2Audiobooks(options: {
    prefix?: string;
    paths?: string[];
    recursive?: boolean;
    onProgress?: (progress: R2ImportProgress) => void;
  }) {
    try {
      const result = await bulkImportR2AudiobooksLocally(options);
      invalidateImportedR2IndexCache();
      void this.enrichR2AudiobookRecords(result?.audiobooks).catch((error) => {
        console.warn(
          "[booksService] R2 bulk background metadata failed:",
          error,
        );
      });
      return result;
    } catch (localError) {
      console.warn(
        "[booksService] Local R2 bulk import failed, using edge manager:",
        localError,
      );
      const result = await invokeR2Manager({
        action: "bulk-import-audiobooks",
        payload: {
          prefix: options.prefix,
          paths: options.paths,
          recursive: options.recursive ?? true,
        },
      });
      invalidateImportedR2IndexCache();
      void this.enrichR2AudiobookRecords(result?.audiobooks).catch((error) => {
        console.warn(
          "[booksService] R2 bulk background metadata failed:",
          error,
        );
      });
      return result;
    }
  },

  async quickImportR2AudioFile(
    path: string,
    onProgress?: (progress: R2ImportProgress) => void,
  ) {
    const paths = uniqueAudioPaths([path]);
    if (paths.length !== 1) {
      throw new Error("R2 import file requires one valid audio path.");
    }

    try {
      notifyR2ImportProgress(onProgress, {
        processed: 0,
        total: 1,
        percent: 10,
        stage: "saving",
      });
      notifyR2ImportProgress(onProgress, {
        processed: 0,
        total: 1,
        percent: 45,
        stage: "saving",
      });
      const result = await withTimeout(
        quickImportR2AudiobookViaRpc(paths[0]),
        R2_QUICK_IMPORT_TIMEOUT_MS,
        "R2 import RPC timed out",
      );
      notifyR2ImportProgress(onProgress, {
        processed: 0,
        total: 1,
        percent: 90,
        stage: "checking",
      });
      const confirmed = await waitForR2AudiobookRecord(paths[0]);
      notifyR2ImportProgress(onProgress, {
        processed: 1,
        total: 1,
        percent: 100,
        stage: "done",
      });
      invalidateImportedR2IndexCache();
      void this.enrichR2AudiobookRecord(paths[0], confirmed).catch((error) => {
        console.warn("[booksService] R2 background metadata failed:", error);
      });
      return {
        ...result,
        audiobooks: [confirmed],
      };
    } catch (localError) {
      console.warn(
        "[booksService] R2 import RPC failed, using edge manager:",
        localError,
      );
      notifyR2ImportProgress(onProgress, {
        processed: 0,
        total: 1,
        percent: 70,
        stage: "fallback",
      });
      const audiobook = await withTimeout(
        this.importR2Audiobook(paths[0], buildR2QuickImportPayload(paths[0])),
        R2_QUICK_IMPORT_TIMEOUT_MS,
        "Edge R2 import timed out",
      );
      notifyR2ImportProgress(onProgress, {
        processed: 0,
        total: 1,
        percent: 90,
        stage: "checking",
      });
      const confirmed = await waitForR2AudiobookRecord(paths[0]);
      notifyR2ImportProgress(onProgress, {
        processed: 1,
        total: 1,
        percent: 100,
        stage: "done",
      });
      invalidateImportedR2IndexCache();
      void this.enrichR2AudiobookRecord(paths[0], confirmed || audiobook).catch(
        (error) => {
          console.warn("[booksService] R2 background metadata failed:", error);
        },
      );
      return {
        success: true,
        imported: 1,
        created: 1,
        skipped: 0,
        failed: 0,
        total: 1,
        failures: [],
        audiobooks: [confirmed || audiobook],
      };
    }
  },

  /**
   * Normalizes ISBN by removing dashes, spaces, and 'ISBN:' prefix.
   */
  normalizeIsbn(isbn: string): string {
    return isbn
      .replace(/^ISBN:/i, "")
      .replace(/[-\s]/g, "")
      .trim();
  },

  /** Normalize a Vietnamese title for fuzzy matching */
  normalizeTitle(title: string): string {
    if (!title) return "";
    return title
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ỹ0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  /**
   * Upgrades low-resolution Google Books thumbnails to higher resolution.
   * Also ensures HTTPS for all URLs.
   */
  upgradeImageUrl(url: string | null | undefined): string | undefined {
    return normalizeCoverUrl(url);
  },

  // --- Physical Books Metadata ---

  async fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
    const cleanIsbn = this.normalizeIsbn(isbn);

    let googleItem = null;
    let openLibData = null;

    try {
      const googleRes = await axios.get(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`,
        { timeout: 5000 },
      );
      googleItem = googleRes.data.items?.[0]?.volumeInfo || null;
    } catch (error: any) {
      console.warn(`Google Books API failed for ${cleanIsbn}:`, error.message);
    }

    try {
      const openLibRes = await axios.get(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
        { timeout: 5000 },
      );
      const openLibKey = `ISBN:${cleanIsbn}`;
      openLibData = openLibRes.data[openLibKey] || null;
    } catch (error: any) {
      console.warn(`Open Library API failed for ${cleanIsbn}:`, error.message);
    }

    if (!googleItem && !openLibData) return null;

    const translations = await ai.translateMetadata(
      googleItem?.title || openLibData?.title || "Unknown Title",
      googleItem?.description ||
        openLibData?.notes ||
        openLibData?.description ||
        "",
      googleItem?.authors?.join(", ") ||
        openLibData?.authors?.map((a: any) => a.name).join(", ") ||
        "Unknown Author",
    );

    return {
      title: googleItem?.title || openLibData?.title || "Unknown Title",
      author:
        googleItem?.authors?.join(", ") ||
        openLibData?.authors?.map((a: any) => a.name).join(", ") ||
        "Unknown Author",
      description:
        googleItem?.description ||
        openLibData?.notes ||
        openLibData?.description ||
        "",
      publisher: googleItem?.publisher || openLibData?.publishers?.[0]?.name,
      publishedDate: googleItem?.publishedDate || openLibData?.publish_date,
      pageCount: googleItem?.pageCount || openLibData?.number_of_pages,
      categories:
        googleItem?.categories ||
        openLibData?.subjects?.map((s: any) => s.name) ||
        [],
      thumbnail: this.upgradeImageUrl(
        openLibData?.cover?.large ||
          openLibData?.cover?.medium ||
          googleItem?.imageLinks?.thumbnail ||
          googleItem?.imageLinks?.smallThumbnail ||
          `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`,
      ),
      isbn: cleanIsbn,
      language: googleItem?.language || "vi",
      averageRating: googleItem?.averageRating,
      ratingsCount: googleItem?.ratingsCount,
      edition:
        googleItem?.contentVersion ||
        openLibData?.identifiers?.openlibrary?.[0],
      title_en: translations.title_en,
      title_vi: translations.title_vi,
      description_en: translations.description_en,
      description_vi: translations.description_vi,
      author_en: translations.author_en,
      author_vi: translations.author_vi,
      syncSource: {
        google: !!googleItem,
        openLib: !!openLibData,
      },
    };
  },

  /**
   * Fetches metadata by title and author when ISBN is not available.
   * Calls the search-book-metadata Supabase Edge Function to securely use the API key.
   */
  cleanTitle(title: string): string {
    return title
      .replace(/\(Audio.*?\)/gi, "")
      .replace(/\(Tiếng.*?\)/gi, "")
      .replace(/\(Full.*?\)/gi, "")
      .replace(/\[.*?\]/g, "")
      .replace(/-.*?$/, "")
      .trim();
  },

  async fetchMetadataBySearch(
    title: string,
    author: string,
    titleEn?: string,
  ): Promise<Partial<BookMetadata> | null> {
    const cleanT = this.cleanTitle(title);
    const known = getKnownAudiobookMetadata(cleanT);
    if (known) return known;

    const lookupTitle = titleEn || cleanT;
    const cleanAuthor = author ? this.normalizeTitle(author) : "";

    let openLibCover = null;
    let openLibAuthor: string | null = null;

    // 1. Try Open Library Search for Cover (English title is the source of truth for audiobooks)
    try {
      const openLibraryQueries = [
        { title: lookupTitle, author: cleanAuthor },
        { title: lookupTitle, author: "" },
        ...(titleEn ? [{ title, author: "" }] : []),
      ].filter((query) => query.title);

      for (const query of openLibraryQueries) {
        const params = new URLSearchParams({
          title: query.title,
          limit: "1",
        });
        if (query.author) params.set("author", query.author);

        const olSearchRes = await axios.get(
          `https://openlibrary.org/search.json?${params.toString()}`,
          { timeout: 5000 },
        );
        const doc = olSearchRes.data.docs?.[0];
        if (!doc) continue;

        if (doc.cover_i) {
          openLibCover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        } else if (doc.isbn?.[0]) {
          openLibCover = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
        }
        if (doc.author_name?.[0]) openLibAuthor = doc.author_name[0];
        if (openLibCover || openLibAuthor) break;
      }
    } catch (e) {
      console.warn("OpenLib search failed:", e);
    }

    // 2. Try Edge Function for Google Books metadata (uses Supabase secret GOOGLE_BOOKS_API_KEY)
    let googleMetadata: any = null;
    try {
      const queryTitle = titleEn || cleanT;
      const { data, error } = await supabase.functions.invoke(
        "search-book-metadata",
        {
          body: { title: queryTitle, author: cleanAuthor },
        },
      );

      if (!error && data?.success) {
        googleMetadata = data.data;
      } else {
        // Fallback to client-side Google Books API if edge function fails or is not deployed
        const query = cleanAuthor
          ? `intitle:${lookupTitle} inauthor:${cleanAuthor}`
          : `intitle:${lookupTitle}`;
        const gRes = await axios.get(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`,
          { timeout: 5000 },
        );
        const item = gRes.data.items?.[0]?.volumeInfo;
        if (item) {
          googleMetadata = {
            title: item.title,
            author: item.authors?.join(", "),
            description: item.description,
            thumbnail:
              item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail,
            categories: item.categories || [],
          };
        }
      }
    } catch (e) {
      console.warn("Metadata search failed, trying direct fallback:", e);
      try {
        const query = `intitle:${lookupTitle}`;
        const gRes = await axios.get(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`,
          { timeout: 5000 },
        );
        const item = gRes.data.items?.[0]?.volumeInfo;
        if (item) {
          googleMetadata = {
            title: item.title,
            author: item.authors?.join(", "),
            description: item.description,
            thumbnail:
              item.imageLinks?.thumbnail || item.imageLinks?.smallThumbnail,
            categories: item.categories || [],
          };
        }
      } catch (innerE) {
        console.warn("Direct fallback also failed:", innerE);
      }
    }

    if (!openLibCover && !googleMetadata) return null;

    return {
      title: googleMetadata?.title || title,
      title_en: titleEn || googleMetadata?.title,
      title_vi: title,
      author: googleMetadata?.author || openLibAuthor || author,
      description: googleMetadata?.description,
      thumbnail: this.upgradeImageUrl(
        openLibCover || googleMetadata?.thumbnail,
      ),
      categories: googleMetadata?.categories || [],
    };
  },

  async enrichBookPayload<T extends MetadataPayload>(payload: T): Promise<T> {
    const enriched: MetadataPayload = { ...payload };
    const cleanIsbn = hasMetadataValue(enriched.isbn)
      ? this.normalizeIsbn(String(enriched.isbn))
      : "";

    if (cleanIsbn) enriched.isbn = cleanIsbn;

    const normalizedCover = this.upgradeImageUrl(enriched.cover_url);
    if (normalizedCover) enriched.cover_url = normalizedCover;

    if (cleanIsbn && needsBookMetadataLookup(enriched)) {
      try {
        applyBookMetadata(enriched, await this.fetchBookMetadata(cleanIsbn));
      } catch (error) {
        console.warn(
          `[booksService] ISBN metadata lookup failed for ${cleanIsbn}:`,
          error,
        );
      }
    }

    if (needsBookMetadataLookup(enriched) && hasMetadataValue(enriched.title)) {
      try {
        applyBookMetadata(
          enriched,
          await this.fetchMetadataBySearch(
            String(enriched.title),
            String(enriched.author || ""),
            hasMetadataValue(enriched.title_en)
              ? String(enriched.title_en)
              : undefined,
          ),
        );
      } catch (error) {
        console.warn(
          `[booksService] Search metadata lookup failed for ${enriched.title}:`,
          error,
        );
      }
    }

    const finalCover = this.upgradeImageUrl(enriched.cover_url);
    if (finalCover) enriched.cover_url = finalCover;

    return enriched as T;
  },

  async enrichAudiobookPayload<T extends MetadataPayload>(
    payload: T,
  ): Promise<T> {
    const enriched: MetadataPayload = { ...payload };
    const cleanIsbn = hasMetadataValue(enriched.isbn)
      ? this.normalizeIsbn(String(enriched.isbn))
      : "";

    if (cleanIsbn) enriched.isbn = cleanIsbn;

    const normalizedCover = this.upgradeImageUrl(enriched.cover_url);
    enriched.cover_url = normalizedCover || null;

    let canonicalBook: CanonicalBookRecord | null = null;
    try {
      const { data } = await supabase
        .from("books")
        .select(
          "isbn,title,author,description,cover_url,category,title_en,title_vi,description_en,description_vi",
        );
      canonicalBook = findCanonicalBookMatch(
        enriched as AudiobookRecord,
        data || [],
      );
    } catch (error) {
      console.warn(
        "[booksService] Audiobook canonical book lookup failed:",
        error,
      );
    }

    const vietnameseTitle = String(enriched.title_vi || enriched.title || "");
    if (vietnameseTitle && !hasMetadataValue(enriched.title_vi)) {
      enriched.title_vi = vietnameseTitle;
    }

    const englishTitle = await resolveAudiobookEnglishTitle(
      enriched,
      canonicalBook,
    );
    if (englishTitle) enriched.title_en = englishTitle;

    if (canonicalBook) {
      applyCanonicalAudiobookMetadata(
        enriched,
        metadataFromBook(canonicalBook),
        true,
      );
    }

    if (cleanIsbn && needsAudiobookMetadataLookup(enriched)) {
      try {
        applyAudiobookMetadata(
          enriched,
          await this.fetchBookMetadata(cleanIsbn),
        );
      } catch (error) {
        console.warn(
          `[booksService] Audiobook ISBN metadata lookup failed for ${cleanIsbn}:`,
          error,
        );
      }
    }

    if (
      needsAudiobookMetadataLookup(enriched) &&
      hasMetadataValue(enriched.title)
    ) {
      try {
        applyCanonicalAudiobookMetadata(
          enriched,
          await this.fetchMetadataBySearch(
            String(enriched.title),
            canonicalBook?.author || "",
            englishTitle || undefined,
          ),
          true,
        );
      } catch (error) {
        console.warn(
          `[booksService] Audiobook metadata search failed for ${enriched.title}:`,
          error,
        );
      }
    }

    const finalCover = this.upgradeImageUrl(enriched.cover_url);
    if (finalCover) enriched.cover_url = finalCover;

    return enriched as T;
  },

  // --- Audiobooks Logic ---

  async browseAudiobooks(limit = 100): Promise<EnrichedAudiobook[]> {
    const { data, error } = await supabase
      .from("audiobook_metadata")
      .select(
        "*, book:books(isbn, title, author, description, cover_url, category, title_en, title_vi, description_en, description_vi)",
      )
      .order("scraped_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error || !data) return [];
    return this.enrichWithBookMetadata(data, true, {
      translateMissing: false,
    });
  },

  /**
   * Helper function to calculate total duration from chapters
   */
  calculateTotalDuration(chapters: any[] | undefined | null): number {
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0)
      return 0;
    return chapters.reduce((sum, ch) => {
      // Ensure we're adding numbers, fallback to 0
      const duration =
        typeof ch.duration_seconds === "number"
          ? ch.duration_seconds
          : parseInt(String(ch.duration_seconds || 0), 10);
      return sum + (isNaN(duration) ? 0 : duration);
    }, 0);
  },

  /**
   * Main entry point for accurate duration calculation
   */
  calculateAudiobookDuration(ab: AudiobookRecord): number {
    const sumDuration = this.calculateTotalDuration(ab.chapters);
    // If chapters have durations, they are the source of truth
    if (sumDuration > 0) return sumDuration;
    // Otherwise fallback to the main duration_seconds field
    return ab.duration_seconds || 0;
  },

  async enrichWithBookMetadata(
    audiobooks: AudiobookRecord[],
    fast = true, // Default to fast for better UX
    options: { translateMissing?: boolean } = {},
  ): Promise<EnrichedAudiobook[]> {
    if (!audiobooks || audiobooks.length === 0) return [];

    const enriched: EnrichedAudiobook[] = [];
    const translateMissing = options.translateMissing ?? false;
    let canonicalBooks: CanonicalBookRecord[] = [];

    try {
      const { data } = await supabase
        .from("books")
        .select(
          "isbn,title,author,description,cover_url,category,title_en,title_vi,description_en,description_vi",
        );
      canonicalBooks = data || [];
    } catch (error) {
      console.warn("[booksService] Failed to load canonical books:", error);
    }

    for (const ab of audiobooks) {
      try {
        if (!ab) continue;

        // 1. Calculate duration (always fast, uses local data)
        const calculatedDuration = this.calculateAudiobookDuration(ab);

        const localBook =
          ((ab.book as any)?.title ? (ab.book as any) : null) ||
          findCanonicalBookMatch(ab, canonicalBooks);
        const fastPayload: MetadataPayload = {
          ...ab,
          cover_url: this.upgradeImageUrl(ab.cover_url) || null,
          title_vi: ab.title_vi || ab.title,
        };
        const englishTitle = await resolveAudiobookEnglishTitle(
          fastPayload,
          localBook,
        );
        if (englishTitle) fastPayload.title_en = englishTitle;

        let fastFoundMetadata = false;
        if (localBook) {
          fastFoundMetadata = applyCanonicalAudiobookMetadata(
            fastPayload,
            metadataFromBook(localBook),
            true,
          );
        }

        // 2. FAST PATH: Return immediately after local canonical matching
        if (fast) {
          const canonicalCover = this.upgradeImageUrl(fastPayload.cover_url);

          if (fastFoundMetadata && ab.id) {
            void supabase
              .from("audiobook_metadata")
              .update({
                author: fastPayload.author || null,
                cover_url: canonicalCover || null,
                title_en: fastPayload.title_en,
              })
              .eq("id", ab.id);
          }

          enriched.push({
            ...ab,
            ...fastPayload,
            canonical_author: fastPayload.author || null,
            canonical_description: fastPayload.description || null,
            canonical_cover_url: canonicalCover || null,
            duration: this.formatDuration(calculatedDuration),
            duration_seconds: calculatedDuration,
          });
          continue;
        }

        // 3. SLOW PATH: Enrichment (Only if fast=false)
        let canonical_author = fastPayload.author;
        let canonical_description = fastPayload.description;
        let canonical_cover_url = fastPayload.cover_url;
        let foundNewMetadata = fastFoundMetadata;

        // Try local match from JOIN first
        if (localBook) {
          canonical_author = (localBook as any).author || canonical_author;
          canonical_description =
            (localBook as any).description || canonical_description;
          canonical_cover_url =
            (localBook as any).cover_url || canonical_cover_url;
        } else if (ab.isbn) {
          const { data: matched } = await supabase
            .from("books")
            .select("author, description, cover_url")
            .eq("isbn", ab.isbn)
            .maybeSingle();
          if (matched) {
            canonical_author = matched.author || canonical_author;
            canonical_description =
              matched.description || canonical_description;
            canonical_cover_url = matched.cover_url || canonical_cover_url;
            foundNewMetadata = true;
          }
        }

        if (
          !canonical_cover_url ||
          !canonical_author ||
          !canonical_description
        ) {
          const externalMetadata = await this.fetchMetadataBySearch(
            ab.title,
            localBook?.author || "",
            englishTitle,
          );

          if (externalMetadata) {
            const externalPayload: MetadataPayload = {
              ...fastPayload,
              author: canonical_author,
              description: canonical_description,
              cover_url: canonical_cover_url,
            };
            applyCanonicalAudiobookMetadata(
              externalPayload,
              externalMetadata,
              true,
            );
            canonical_author = externalPayload.author || canonical_author;
            canonical_cover_url =
              externalPayload.cover_url || canonical_cover_url || null;
            foundNewMetadata = true;
          }
        }

        // AI Translation if missing
        let {
          title_en,
          title_vi,
          description_en,
          description_vi,
          author_en,
          author_vi,
        } = fastPayload;

        if (translateMissing && (!title_en || !title_vi)) {
          try {
            const translations = await ai.translateMetadata(
              ab.title,
              canonical_description || "",
              canonical_author || "",
            );
            if (translations) {
              title_en = translations.title_en;
              title_vi = translations.title_vi;
              description_en = translations.description_en;
              description_vi = translations.description_vi;
              author_en = translations.author_en;
              author_vi = translations.author_vi;
              foundNewMetadata = true;
            }
          } catch (e) {
            console.warn(
              `[booksService] Translation failed for ${ab.title}:`,
              e,
            );
          }
        }

        const final_cover_url = this.upgradeImageUrl(
          canonical_cover_url || ab.cover_url,
        );

        // Update DB if found new info
        if (foundNewMetadata || final_cover_url !== ab.cover_url) {
          supabase
            .from("audiobook_metadata")
            .update({
              author: canonical_author || null,
              cover_url: final_cover_url || null,
              title_en,
            })
            .eq("id", ab.id)
            .then(({ error }) => {
              if (error)
                console.warn("Failed to update audiobook metadata:", error);
            });
        }

        enriched.push({
          ...ab,
          title_en,
          title_vi,
          description_en,
          description_vi,
          author_en,
          author_vi,
          canonical_author: canonical_author || null,
          canonical_description: canonical_description || null,
          canonical_cover_url: final_cover_url || null,
          duration: this.formatDuration(calculatedDuration),
          duration_seconds: calculatedDuration,
        });
      } catch (err) {
        console.error("[booksService] Failed to enrich item:", ab?.title, err);
        // Push raw item as fallback so the list doesn't break
        enriched.push(ab as any);
      }
    }

    return enriched;
  },

  async searchAudiobooks(
    query: string,
    limit = 100,
  ): Promise<EnrichedAudiobook[]> {
    const { data, error } = await supabase.rpc("search_audiobooks", {
      query,
      lim: limit,
    });
    if (error || !data) {
      let fallback = supabase
        .from("audiobook_metadata")
        .select(
          "*, book:books(isbn, title, author, description, cover_url, category, title_en, title_vi, description_en, description_vi)",
        )
        .order("scraped_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      const cleanQuery = query.trim();
      if (cleanQuery) {
        const escaped = cleanQuery.replace(/[%_,]/g, "\\$&");
        fallback = fallback.or(
          [
            `title.ilike.%${escaped}%`,
            `title_vi.ilike.%${escaped}%`,
            `title_en.ilike.%${escaped}%`,
            `author.ilike.%${escaped}%`,
            `isbn.eq.${escaped}`,
          ].join(","),
        );
      }

      const { data: fallbackData, error: fallbackError } = await fallback;
      if (fallbackError || !fallbackData) return [];
      return this.enrichWithBookMetadata(fallbackData, true);
    }
    return this.enrichWithBookMetadata(data, true);
  },

  async getAudiobookByISBN(isbn: string): Promise<EnrichedAudiobook | null> {
    const { data, error } = await supabase
      .from("audiobook_metadata")
      .select("*, book:books(title, author, description, cover_url)")
      .eq("isbn", isbn)
      .maybeSingle();
    if (error || !data) return null;
    const enriched = await this.enrichWithBookMetadata([data]);
    return enriched[0];
  },

  formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return "0 phút";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    let parts = [];
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    if (secs > 0 && hours === 0) parts.push(`${secs} giây`); // Only show seconds if less than an hour

    if (parts.length === 0) return "0 phút";

    return parts.join(" ");
  },

  /**
   * Helper to encode a full URL path properly while preserving structure.
   */
  encodeUrl(rawUrl: string): string {
    try {
      const urlObj = new URL(rawUrl);
      const pathParts = urlObj.pathname.split("/");
      const encodedPath = pathParts
        .map((part) => encodeURIComponent(decodeURIComponent(part)))
        .join("/");
      return `${urlObj.origin}${encodedPath}${urlObj.search}`;
    } catch (e) {
      // Fallback for non-standard URLs
      return rawUrl.replace(/ /g, "%20");
    }
  },

  getPlaybackUrl(record: AudiobookRecord): string {
    const R2_PUBLIC_URL = "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev";

    // 1. Check tags for explicit r2_path
    if (record.tags) {
      const tagsArr = Array.isArray(record.tags) ? record.tags : [];
      const r2Tag = tagsArr.find(
        (t: any) => typeof t === "string" && t.startsWith("r2_path:"),
      );
      if (r2Tag) {
        const r2Path = (r2Tag as string).replace("r2_path:", "");
        const parts = r2Path.split("/").map((p) => encodeURIComponent(p));
        return `${R2_PUBLIC_URL}/${parts.join("/")}`;
      }
    }

    // 2. Use source_url directly if available
    let url = record.source_url;
    if (url) {
      // Replace worker URL with public URL if needed
      if (url.includes("workers.dev")) {
        url = url.replace(
          "https://r2-audio-worker.vuduytien20042004.workers.dev",
          R2_PUBLIC_URL,
        );
      }

      return this.encodeUrl(url);
    }

    return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
  },

  getChapterUrl(record: AudiobookRecord, chapterIndex: number): string {
    const basePlaybackUrl = this.getPlaybackUrl(record);

    // If no chapters or it's the first chapter, use the base URL
    if (!record.chapters || record.chapters.length === 0)
      return basePlaybackUrl;

    const firstChapter = record.chapters[0];
    const firstIdx = firstChapter?.index || 1;

    if (chapterIndex === firstIdx) return basePlaybackUrl;

    const offset = chapterIndex - firstIdx;
    if (offset === 0) return basePlaybackUrl;

    // Logic to derive chapter URL from base URL (assuming sequential naming)
    const parts = basePlaybackUrl.split("/");
    const filename = decodeURIComponent(parts.pop() || "");

    // Find all number sequences and their indices
    const matches = Array.from(filename.matchAll(/\d+/g));
    if (matches.length > 0) {
      // We assume the LAST number sequence in the filename is the chapter/part number
      const lastMatch = matches[matches.length - 1];
      const originalNumStr = lastMatch[0];
      const originalNum = parseInt(originalNumStr, 10);
      const targetNum = originalNum + offset;
      const matchIndex = lastMatch.index!;

      let newNumStr = targetNum.toString();
      if (originalNumStr.startsWith("0") && originalNumStr.length > 1) {
        newNumStr = newNumStr.padStart(originalNumStr.length, "0");
      }

      // Replace only at the specific index
      const newFilename =
        filename.substring(0, matchIndex) +
        newNumStr +
        filename.substring(matchIndex + originalNumStr.length);

      // Re-encode everything
      parts.push(newFilename);
      return this.encodeUrl(parts.join("/"));
    }

    return this.encodeUrl(basePlaybackUrl);
  },

  // --- Recommendations ---

  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<Book[]> {
    try {
      const { data: history, error: historyError } = await supabase
        .from("borrow_records")
        .select("book_id, books(category)")
        .eq("user_id", userId);

      if (historyError) throw historyError;

      const genreCounts: Record<string, number> = {};
      const borrowedIsbns: string[] = [];

      history?.forEach((record: any) => {
        borrowedIsbns.push(record.book_id);
        const category = (record.books as any)?.category;
        if (category && category !== "Uncategorized") {
          genreCounts[category] = (genreCounts[category] || 0) + 1;
        }
      });

      const favoriteGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([genre]) => genre);

      let recommendedBooks: Book[] = [];

      if (favoriteGenres.length > 0) {
        const { data: books, error: bookError } = await supabase
          .from("books")
          .select("*")
          .in("category", favoriteGenres.slice(0, 3))
          .not("isbn", "in", `(${borrowedIsbns.join(",") || '""'})`)
          .order("average_rating", { ascending: false })
          .limit(limit);

        if (!bookError) recommendedBooks = books || [];
      }

      if (recommendedBooks.length < limit) {
        const { data: popularBooks, error: popularError } = await supabase
          .from("books")
          .select("*")
          .not("isbn", "in", `(${borrowedIsbns.join(",") || '""'})`)
          .order("average_rating", { ascending: false })
          .limit(limit - recommendedBooks.length);

        if (!popularError && popularBooks)
          recommendedBooks = [...recommendedBooks, ...popularBooks];
      }

      return recommendedBooks;
    } catch (error) {
      console.error("[booksService] Recommendation error:", error);
      return [];
    }
  },

  async getRecommendationsByGenres(
    genres: string[],
    limit: number = 10,
    excludeIsbns: string[] = [],
  ): Promise<Book[]> {
    try {
      if (!genres || genres.length === 0) return [];

      let query = supabase.from("books").select("*").in("category", genres);

      if (excludeIsbns.length > 0) {
        query = query.not("isbn", "in", `(${excludeIsbns.join(",")})`);
      }

      const { data, error } = await query
        .order("average_rating", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[booksService] Genre recommendation error:", error);
      return [];
    }
  },

  async getSemanticRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<Book[]> {
    try {
      const { data: history, error: historyError } = await supabase
        .from("borrow_records")
        .select("books(title, author, category, description)")
        .eq("user_id", userId)
        .order("borrowed_at", { ascending: false })
        .limit(5);

      if (historyError || !history || history.length === 0) {
        return this.getPersonalizedRecommendations(userId, limit);
      }

      const profileText = history
        .map(
          (h: any) => `${h.books.title} ${h.books.author} ${h.books.category}`,
        )
        .join(" ");

      const profileEmbedding = await ai.generateEmbedding(profileText);

      const { data: recommendations, error: matchError } = await supabase.rpc(
        "match_books",
        {
          query_embedding: profileEmbedding,
          match_threshold: 0.4,
          match_count: limit + 5,
        },
      );

      if (matchError) throw matchError;

      const borrowedTitles = history.map((h: any) => h.books.title);
      return (recommendations || [])
        .filter((b: any) => !borrowedTitles.includes(b.title))
        .slice(0, limit);
    } catch (error) {
      console.error("[booksService] Semantic error:", error);
      return this.getPersonalizedRecommendations(userId, limit);
    }
  },

  async getSimilarBooks(isbn: string, limit = 5): Promise<Book[]> {
    try {
      const { data: currentBook } = await supabase
        .from("books")
        .select("embedding")
        .eq("isbn", isbn)
        .single();

      if (!currentBook?.embedding) return [];

      const { data: recommendations, error: matchError } = await supabase.rpc(
        "match_books",
        {
          query_embedding: currentBook.embedding,
          match_threshold: 0.4,
          match_count: limit + 1,
        },
      );

      if (matchError) throw matchError;

      return (recommendations || [])
        .filter((b: any) => b.isbn !== isbn)
        .slice(0, limit);
    } catch (error) {
      console.error("[booksService] Similar books error:", error);
      return [];
    }
  },

  async getAudiobookBySourceId(
    platform: string,
    sourceId: string,
  ): Promise<EnrichedAudiobook | null> {
    const { data, error } = await supabase
      .from("audiobook_metadata")
      .select(
        "*, book:books(isbn, title, author, description, cover_url, category, title_en, title_vi, description_en, description_vi)",
      )
      .eq("source_platform", platform)
      .eq("source_id", sourceId)
      .order("scraped_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (error || !data?.[0]) return null;
    const enriched = await this.enrichWithBookMetadata([data[0]], true, {
      translateMissing: false,
    });
    return enriched[0];
  },

  async syncBookMetadata(isbn: string) {
    const cleanIsbn = this.normalizeIsbn(isbn);
    const metadata = await this.fetchBookMetadata(cleanIsbn);
    if (!metadata) return null;

    // Check if book exists
    const { data: existing } = await supabase
      .from("books")
      .select("isbn")
      .eq("isbn", cleanIsbn)
      .maybeSingle();

    const payload = await this.enrichBookPayload({
      title: metadata.title,
      author: metadata.author,
      description: metadata.description,
      cover_url: metadata.thumbnail,
      published_date: metadata.publishedDate,
      category: metadata.categories?.[0] || "Uncategorized",
      language: metadata.language,
      average_rating: metadata.averageRating,
      edition: metadata.edition,
      isbn: metadata.isbn || isbn,
      title_en: metadata.title_en,
      title_vi: metadata.title_vi,
      description_en: metadata.description_en,
      description_vi: metadata.description_vi,
      author_en: metadata.author_en,
      author_vi: metadata.author_vi,
    });

    if (existing) {
      const { error } = await supabase
        .from("books")
        .update(payload)
        .eq("isbn", cleanIsbn);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("books")
        .insert([{ ...payload, isbn: cleanIsbn }]);
      if (error) throw error;
    }
    return payload;
  },

  /**
   * Performs a semantic search for books using AI embeddings and match_books RPC.
   */
  async semanticSearch(query: string, limit = 10): Promise<Book[]> {
    try {
      const embedding = await ai.generateEmbedding(query);
      const { data, error } = await supabase.rpc("match_books", {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: limit,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[booksService] Semantic search error:", error);
      throw error;
    }
  },

  async bulkEnrichAudiobooks() {
    const { data: audiobooks, error: fetchError } = await supabase
      .from("audiobook_metadata")
      .select("*");

    if (fetchError) throw fetchError;
    if (!audiobooks || audiobooks.length === 0) return { count: 0 };

    const enriched = await this.enrichWithBookMetadata(audiobooks, false); // false = full enrichment

    let updatedCount = 0;
    for (const item of enriched) {
      if (
        item.canonical_author ||
        item.canonical_cover_url ||
        item.canonical_description
      ) {
        const { error: updateError } = await supabase
          .from("audiobook_metadata")
          .update({
            author: item.canonical_author || item.author,
            cover_url: item.canonical_cover_url || item.cover_url,
            description: item.canonical_description || item.description,
            title_en: item.title_en,
            title_vi: item.title_vi,
            description_en: item.description_en,
            description_vi: item.description_vi,
            author_en: item.author_en,
            author_vi: item.author_vi,
            narrator_en: item.narrator_en,
            narrator_vi: item.narrator_vi,
            duration_seconds: item.duration_seconds,
            tags: {
              ...(item.tags || {}),
              is_enriched: true,
              enriched_at: new Date().toISOString(),
            },
          } as any)
          .eq("id", item.id);

        if (!updateError) updatedCount++;
      }
    }

    return { total: audiobooks.length, updated: updatedCount };
  },
};
