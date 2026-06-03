export const R2_PUBLIC_URL =
  "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev";
export const R2_IMPORT_DRAFT_KEY_PREFIX = "BIBLIO_R2_AUDIOBOOK_DRAFT:";

export const buildR2PublicUrl = (key: string) =>
  key
    ? `${R2_PUBLIC_URL}/${key.split("/").map(encodeURIComponent).join("/")}`
    : "";

export const parseCategories = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const getR2DraftKey = (key: string) =>
  `${R2_IMPORT_DRAFT_KEY_PREFIX}${key}`;

export const normalizeR2KeyForMatch = (value?: string | null): string => {
  let key = String(value || "").trim();
  if (!key) return "";

  try {
    key = decodeURIComponent(key);
  } catch {
    // keep raw keys that are not URL-encoded
  }

  return key
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .normalize("NFC")
    .toLowerCase();
};

export const normalizeR2FolderForMatch = (value?: string | null): string => {
  const key = normalizeR2KeyForMatch(value);
  if (!key) return "";
  return key.endsWith("/") ? key : `${key}/`;
};

export const extractR2KeyFromUrl = (value?: string | null): string | null => {
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
