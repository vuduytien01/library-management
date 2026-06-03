import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    buildR2PublicUrl,
    extractR2KeyFromUrl,
    getR2DraftKey,
    normalizeR2FolderForMatch,
    normalizeR2KeyForMatch,
    parseCategories,
} from "./r2Helpers";

type AudiobookFormData = {
  title: string;
  title_vi: string;
  title_en: string;
  author: string;
  author_vi: string;
  author_en: string;
  narrator: string;
  narrator_vi: string;
  narrator_en: string;
  duration: string;
  cover_url: string;
  source: string;
  source_id: string;
  source_url: string;
  description: string;
  description_vi: string;
  description_en: string;
  publisher: string;
  isbn: string;
  categories: string;
  published_at: string;
  language: string;
};

type R2Index = { keys: Set<string>; folders: Set<string> };

const R2_IMPORT_DRAFT_KEY_PREFIX = "BIBLIO_R2_AUDIOBOOK_DRAFT:";

export const addImportedR2Folder = (
  folders: Set<string>,
  key?: string | null,
) => {
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

export const addImportedR2Key = (keys: Set<string>, key?: string | null) => {
  const normalized = normalizeR2KeyForMatch(key);
  if (normalized) keys.add(normalized);
};

export const buildImportedR2IndexFromAudiobooks = (
  audiobooks?: any[] | null,
): R2Index => {
  const keys = new Set<string>();
  const folders = new Set<string>();

  (Array.isArray(audiobooks) ? audiobooks : []).forEach((audiobook) => {
    addImportedR2Key(keys, audiobook?.r2_key_normalized);

    if (audiobook?.source_platform === "r2") {
      addImportedR2Key(keys, audiobook.source_id);
    }

    addImportedR2Key(keys, extractR2KeyFromUrl(audiobook?.source_url));

    const tags = audiobook?.tags;
    if (Array.isArray(tags)) {
      tags.forEach((tag) => {
        if (typeof tag === "string" && tag.startsWith("r2_path:")) {
          addImportedR2Key(keys, tag.replace("r2_path:", ""));
        }
      });
    } else if (tags && typeof tags === "object") {
      addImportedR2Key(keys, tags.r2_path);
    }
  });

  keys.forEach((key) => addImportedR2Folder(folders, key));
  return { keys, folders };
};

export const applyImportedR2StateFromAudiobooks = (
  items: { files: any[]; folders: any[] },
  audiobooks?: any[] | null,
) => {
  const imported = buildImportedR2IndexFromAudiobooks(audiobooks);

  return {
    files: items.files.map((file) => {
      const fileKey = normalizeR2KeyForMatch(file.key);
      const parentFolder = normalizeR2FolderForMatch(
        fileKey.split("/").slice(0, -1).join("/"),
      );
      const isImported =
        file.isImported ||
        imported.keys.has(fileKey) ||
        imported.folders.has(parentFolder);
      return {
        ...file,
        isImported,
        isDraft: isImported ? false : file.isDraft,
      };
    }),
    folders: items.folders.map((folder) => {
      const folderKey = normalizeR2FolderForMatch(folder.key);
      const isImported =
        folder.isImported ||
        imported.keys.has(folderKey) ||
        imported.folders.has(folderKey);
      return {
        ...folder,
        isImported,
        isDraft: isImported ? false : folder.isDraft,
      };
    }),
  };
};

export const markR2ItemImported = (
  items: { files: any[]; folders: any[] },
  key: string,
) => {
  return {
    files: items.files.map((file) => ({
      ...file,
      isImported: file.isImported || file.key === key,
      isDraft: file.key === key ? false : file.isDraft,
    })),
    folders: items.folders.map((folder) => ({
      ...folder,
      isImported: folder.isImported,
      isDraft: folder.isDraft,
    })),
  };
};

export const markR2FolderImported = (
  items: { files: any[]; folders: any[] },
  prefix: string,
) => {
  const normalizedPrefix = prefix || "";
  return {
    files: items.files.map((file) => ({
      ...file,
      isImported:
        file.isImported ||
        (!!normalizedPrefix && file.key?.startsWith(normalizedPrefix)),
      isDraft:
        !!normalizedPrefix && file.key?.startsWith(normalizedPrefix)
          ? false
          : file.isDraft,
    })),
    folders: items.folders.map((folder) => ({
      ...folder,
      isImported:
        folder.isImported ||
        (!!normalizedPrefix && folder.key?.startsWith(normalizedPrefix)),
      isDraft:
        !!normalizedPrefix && folder.key?.startsWith(normalizedPrefix)
          ? false
          : folder.isDraft,
    })),
  };
};

export const applyR2DraftFlags = async (items: {
  files: any[];
  folders: any[];
}) => {
  const keys = await AsyncStorage.getAllKeys();
  const draftPaths = new Set(
    keys
      .filter((key) => key.startsWith(R2_IMPORT_DRAFT_KEY_PREFIX))
      .map((key) => key.replace(R2_IMPORT_DRAFT_KEY_PREFIX, "")),
  );

  if (draftPaths.size === 0) return items;

  const draftFolders = new Set<string>();
  draftPaths.forEach((path) => {
    if (!path.includes("/")) return;
    draftFolders.add(`${path.split("/").slice(0, -1).join("/")}/`);
  });

  return {
    files: items.files.map((file) => ({
      ...file,
      isDraft: !file.isImported && draftPaths.has(file.key),
    })),
    folders: items.folders.map((folder) => ({
      ...folder,
      isDraft: !folder.isImported && draftFolders.has(folder.key),
    })),
  };
};

export const formDataFromR2Metadata = (
  key: string,
  metadata: Record<string, any>,
): AudiobookFormData => {
  const titleVi =
    metadata.title_vi || metadata.title || key.split("/").pop() || "";
  return {
    title: titleVi,
    title_vi: titleVi,
    title_en: metadata.title_en || "",
    author: metadata.author || metadata.author_vi || metadata.author_en || "",
    author_vi: metadata.author_vi || metadata.author || "",
    author_en: metadata.author_en || metadata.author || "",
    narrator: metadata.narrator || "",
    narrator_vi: metadata.narrator_vi || metadata.narrator || "",
    narrator_en: metadata.narrator_en || metadata.narrator || "",
    duration: String(metadata.duration_seconds || metadata.duration || "0"),
    cover_url: (() => {
      const raw = metadata.cover_url || metadata.thumbnail || "";
      if (!raw) return "";
      if (/^https?:\/\//i.test(String(raw))) return String(raw);
      return buildR2PublicUrl(String(raw));
    })(),
    source: "r2",
    source_id: key,
    source_url: metadata.source_url || buildR2PublicUrl(key),
    description: metadata.description || "",
    description_vi: metadata.description_vi || metadata.description || "",
    description_en: metadata.description_en || metadata.description || "",
    publisher: metadata.publisher || "",
    isbn: metadata.isbn || "",
    categories: Array.isArray(metadata.categories)
      ? metadata.categories.join(", ")
      : metadata.categories || "",
    published_at: metadata.published_at || "",
    language: metadata.language || "vi",
  };
};

export const hasUsableR2Metadata = (metadata: Record<string, any>) =>
  !!(
    (metadata.title_en || metadata.title) &&
    (metadata.author || metadata.author_vi || metadata.author_en) &&
    (metadata.cover_url || metadata.thumbnail)
  );

export const hasAnyR2Metadata = (metadata: Record<string, any>) =>
  !!(
    metadata.title ||
    metadata.title_vi ||
    metadata.title_en ||
    metadata.author ||
    metadata.author_vi ||
    metadata.author_en ||
    metadata.cover_url ||
    metadata.thumbnail ||
    metadata.description ||
    metadata.description_vi ||
    metadata.description_en ||
    metadata.isbn
  );

export const mergeR2MetadataIntoForm = (
  current: AudiobookFormData,
  base: AudiobookFormData,
  enriched: AudiobookFormData,
) => {
  if (current.source_id !== base.source_id) return current;

  const next = { ...current };
  (Object.keys(enriched) as Array<keyof AudiobookFormData>).forEach((key) => {
    const currentValue = current[key];
    const baseValue = base[key];
    const enrichedValue = enriched[key];
    if (!enrichedValue) return;
    if (!currentValue || currentValue === baseValue) {
      next[key] = enrichedValue;
    }
  });
  return next;
};

export const buildAudiobookPayload = (data: AudiobookFormData) => {
  const titleVi = data.title_vi || data.title;
  const title = titleVi || data.title_en || data.title;
  const sourceUrl =
    data.source_url ||
    (data.source === "r2" ? buildR2PublicUrl(data.source_id) : "");
  const payload: any = {
    title,
    title_vi: titleVi || null,
    title_en: data.title_en || null,
    author: data.author || data.author_vi || data.author_en || null,
    author_vi: data.author_vi || data.author || null,
    author_en: data.author_en || data.author || null,
    narrator: data.narrator || null,
    narrator_vi: data.narrator_vi || data.narrator || null,
    narrator_en: data.narrator_en || data.narrator || null,
    duration_seconds: parseInt(data.duration, 10) || null,
    cover_url: data.cover_url || null,
    source_platform: data.source || "fonos",
    source_id: data.source_id,
    source_url: sourceUrl || null,
    description:
      data.description || data.description_vi || data.description_en || null,
    description_vi: data.description_vi || data.description || null,
    description_en: data.description_en || data.description || null,
    publisher: data.publisher || null,
    isbn: data.isbn || null,
    categories: parseCategories(data.categories),
    published_at: data.published_at || null,
    language: data.language || "vi",
    is_free: true,
  };

  if (data.source === "r2") {
    payload.tags = [`r2_path:${data.source_id}`];
    payload.scraped_at = new Date().toISOString();
    payload.skip_metadata_enrichment = true;
  }

  return payload;
};

export { getR2DraftKey };

