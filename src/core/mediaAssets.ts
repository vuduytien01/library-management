export const FALLBACK_BOOK_COVER =
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800&auto=format&fit=crop";

type BookLike = {
  id?: string | number | null;
  isbn?: string | number | null;
  title?: string | null;
  cover_url?: string | null;
  canonical_cover_url?: string | null;
  google_data?: any;
  book?: {
    cover_url?: string | null;
  } | null;
};

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

const addUnique = (items: string[], value?: string | null) => {
  const normalized = normalizeCoverUrl(value);
  if (normalized && !items.includes(normalized)) items.push(normalized);
};

export const normalizeCoverUrl = (
  value?: string | null,
): string | undefined => {
  if (!value || typeof value !== "string") return undefined;

  let url = value.trim();
  if (!isHttpUrl(url)) return undefined;

  url = url.replace(/^http:\/\//i, "https://");

  // Tiki cache URLs in the imported audiobook data often return
  // "Failed to resize" from the CDN, which leaves blank covers in the UI.
  if (/^https:\/\/salt\.tikicdn\.com\/cache\//i.test(url)) {
    return undefined;
  }

  if (
    url.includes("books.google.com/books/content") ||
    url.includes("google.com/books/content")
  ) {
    try {
      const googleUrl = new URL(url);
      googleUrl.searchParams.set("printsec", "frontcover");
      googleUrl.searchParams.set("zoom", "0");
      googleUrl.searchParams.delete("edge");
      googleUrl.searchParams.delete("imgtk");
      googleUrl.searchParams.delete("w");
      url = googleUrl.toString();
    } catch {
      url = url
        .replace(/([?&])edge=curl&?/g, "$1")
        .replace(/([?&])imgtk=[A-Za-z0-9_-]+&?/g, "$1")
        .replace(/([?&])w=\d+&?/g, "$1");

      if (url.includes("zoom=")) {
        url = url.replace(/zoom=\d+/g, "zoom=0");
      } else {
        url += `${url.includes("?") ? "&" : "?"}zoom=0`;
      }

      if (!url.includes("printsec=")) {
        url += `${url.includes("?") ? "&" : "?"}printsec=frontcover`;
      }
    }
  }

  if (url.includes("covers.openlibrary.org")) {
    url = url.replace("-S.jpg", "-L.jpg").replace("-M.jpg", "-L.jpg");
  }

  return url;
};

export const getBookCoverCandidates = (book: BookLike): string[] => {
  const candidates: string[] = [];
  const imageLinks = book.google_data?.imageLinks || {};

  addUnique(candidates, book.canonical_cover_url);
  addUnique(candidates, book.cover_url);
  addUnique(candidates, book.book?.cover_url);
  addUnique(candidates, imageLinks.extraLarge);
  addUnique(candidates, imageLinks.large);
  addUnique(candidates, imageLinks.medium);
  addUnique(candidates, imageLinks.thumbnail);
  addUnique(candidates, imageLinks.smallThumbnail);

  if (book.isbn) {
    const cleanIsbn = String(book.isbn)
      .replace(/^ISBN:/i, "")
      .replace(/[-\s]/g, "");
    if (cleanIsbn) {
      addUnique(
        candidates,
        `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
      );
    }
  }

  return candidates;
};

export const resolveBookCoverUrl = (
  book: BookLike,
  fallback = FALLBACK_BOOK_COVER,
): string => getBookCoverCandidates(book)[0] || fallback;

export const resolveAudiobookCoverUrl = (
  audiobook: BookLike,
  fallback = FALLBACK_BOOK_COVER,
): string => resolveBookCoverUrl(audiobook, fallback);

export const getBookCoverCacheId = (book: BookLike): string =>
  String(book.isbn || book.id || book.title || "book-cover");
