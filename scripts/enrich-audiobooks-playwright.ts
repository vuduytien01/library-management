import "dotenv/config";
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";

type AudiobookRow = {
  id: string;
  title: string;
  title_vi?: string | null;
  title_en?: string | null;
  author?: string | null;
  cover_url?: string | null;
};

type ResolvedMetadata = {
  title_en?: string;
  author?: string;
  cover_url?: string;
  evidence?: string;
};

type MetadataPatch = {
  title_en?: string;
  author?: string;
  cover_url?: string;
};

type CandidateLink = {
  href: string;
  text: string;
};

type PageMetadata = ResolvedMetadata & {
  url: string;
  sourceTitle?: string;
};

type ImageCandidate = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type CoverCandidate = {
  url: string;
  label: string;
  source: string;
};

const args = new Set(process.argv.slice(2));
const getArg = (name: string) => {
  const prefix = `${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
};

const apply = args.has("--apply");
const headful = args.has("--headful");
const all = args.has("--all");
const titleFilter = getArg("--title");
const limit = Number(getArg("--limit") || "50");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL/key in environment");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isHttpUrl = (value?: string | null) => /^https?:\/\//i.test(value || "");

const trustedHostScore = (value: string) => {
  const host = new URL(value).hostname.replace(/^www\./, "");
  if (host === "books.google.com") return 100;
  if (host === "openlibrary.org") return 95;
  if (host.includes("goodreads.com")) return 80;
  if (host.includes("thuvienhoasen.org")) return 75;
  if (host.includes("langmai.org")) return 75;
  if (host.includes("nxbtre.com.vn")) return 70;
  if (host.includes("firstnews.com.vn")) return 70;
  if (host.includes("saigonbooks.vn")) return 65;
  if (host.includes("fahasa.com")) return 60;
  if (host.includes("tiki.vn")) return 55;
  if (host.includes("vinabook.com")) return 55;
  return 10;
};

const normalizeCoverUrl = (value?: string | null): string | undefined => {
  if (!value || !isHttpUrl(value)) return undefined;
  let url = value.trim().replace(/^http:\/\//i, "https://");

  if (/^https:\/\/salt\.tikicdn\.com\/cache\//i.test(url)) return undefined;

  if (url.includes("books.google.com/books/content")) {
    const parsed = new URL(url);
    parsed.searchParams.set("printsec", "frontcover");
    parsed.searchParams.set("zoom", "0");
    parsed.searchParams.delete("edge");
    parsed.searchParams.delete("imgtk");
    parsed.searchParams.delete("w");
    url = parsed.toString();
  }

  if (url.includes("covers.openlibrary.org")) {
    url = url.replace("-S.jpg", "-L.jpg").replace("-M.jpg", "-L.jpg");
  }

  return url;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeMatchText = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanValue = (value?: string | null) =>
  value
    ?.replace(/\s+/g, " ")
    .replace(/^[:"'“”\-\s]+|[:"'“”,.\-\s]+$/g, "")
    .trim();

const looksLikeEnglishTitle = (value?: string | null) =>
  !!value &&
  /[a-zA-Z]/.test(value) &&
  /^[\x00-\x7F\s.,:'"!?&()[\]\/\-]+$/.test(value) &&
  !/^(google books|open library|goodreads|search)$/i.test(value.trim());

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripVietnameseHonorifics = (value: string) =>
  value
    .replace(/^(TS|ThS|PGS\.?\s*TS|GS\.?\s*TS|HT|TT|ĐĐ|Thầy|Sư Ông)\.?\s+/i, "")
    .trim();

const normalizeKnownAuthor = (value?: string | null) => {
  const clean = cleanValue(value)
    ?.replace(/^(author\s+is|author|by|is)\s+/i, "")
    .replace(/\s+\b(by|author)\b$/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ");
  if (!clean) return undefined;

  const known: Record<string, string> = {
    "thich nhat hanh": "Thích Nhất Hạnh",
    "thích nhất hạnh": "Thích Nhất Hạnh",
    "thich minh niem": "Thích Minh Niệm",
    "thích minh niệm": "Thích Minh Niệm",
    "minh niem": "Minh Niệm",
    "minh niệm": "Minh Niệm",
    "nguyen phong": "Nguyên Phong",
    "nguyên phong": "Nguyên Phong",
    "michael newton": "Michael Newton",
    "dr michael newton": "Michael Newton",
    "ts michael newton": "Michael Newton",
    "lama anagarika govinda": "Lama Anagarika Govinda",
    "john vu": "John Vũ",
    "john vũ": "John Vũ",
  };
  const key = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return known[key] || stripVietnameseHonorifics(clean);
};

const isValidAuthor = (value?: string | null) => {
  const clean = normalizeKnownAuthor(value);
  if (!clean) return false;
  if (clean.length < 3 || clean.length > 70) return false;
  if (/[“”"…]|\.{3}/.test(clean)) return false;
  if (/[.!?]$/.test(clean)) return false;
  if (
    /\b(price|google books|open library|goodreads|download|audiobook|review|tiki|fahasa|search|isbn|publisher|published|born|tâm hồn|người|của mình|cách tốt nhất|để chữa lành)\b/i.test(
      clean,
    )
  ) {
    return false;
  }
  if (!/[A-ZÀ-Ỹ]/.test(clean)) return false;
  return /^[\p{L}\p{M} .'\-]+$/u.test(clean);
};

const chooseAuthor = (...values: Array<string | undefined>) => {
  for (const value of values) {
    const clean = normalizeKnownAuthor(value);
    if (isValidAuthor(clean)) return clean;
  }
  return undefined;
};

const normalizeTitleEn = (value?: string | null, titleVi?: string) => {
  const clean = cleanValue(value)
    ?.replace(/\s+-\s+Google Books$/i, "")
    .replace(/\s+\|\s+Goodreads$/i, "")
    .replace(/\s+by\s+[A-ZÀ-Ỹ][\p{L}\p{M} .'\-]{2,70}$/iu, "")
    .replace(/^Cuốn sách\s+/i, "")
    .replace(/^Book\s*:\s*/i, "");
  if (!clean || !looksLikeEnglishTitle(clean)) return undefined;
  if (/\b(publication|english edition|was published|book review|review)\b/i.test(clean)) {
    return undefined;
  }
  if (
    titleVi &&
    clean.toLowerCase() === titleVi.toLowerCase()
  ) {
    return undefined;
  }
  return clean;
};

const isValidCoverUrl = async (value?: string | null) => {
  const url = normalizeCoverUrl(value);
  if (!url) return false;
  try {
    const response = await fetch(url, { method: "GET" });
    const contentType = response.headers.get("content-type") || "";
    return response.ok && contentType.toLowerCase().startsWith("image/");
  } catch {
    return false;
  }
};

const isLikelyCoverImageUrl = (value?: string | null) => {
  const url = normalizeCoverUrl(value);
  if (!url) return false;
  if (
    /logo|avatar|icon|sprite|banner|placeholder|transparent|favicon|apple-touch|share-icons|ytimg\.com|search\.brave\.com/i.test(
      url,
    )
  ) {
    return false;
  }
  return /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(url) ||
    /books\.google\.com\/books\/content|covers\.openlibrary\.org/i.test(url);
};

const titleTokenScore = (value: string, ...needles: Array<string | undefined>) => {
  const haystack = normalizeMatchText(value);
  let score = 0;
  for (const needle of needles) {
    const tokens = normalizeMatchText(needle)
      .split(" ")
      .filter((token) => token.length >= 3);
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }
  }
  return score;
};

const coverCandidateScore = (
  candidate: CoverCandidate,
  titleVi: string,
  metadata: ResolvedMetadata,
) => {
  let score = 0;
  const blob = `${candidate.label} ${candidate.url}`;
  score += titleTokenScore(blob, titleVi, metadata.title_en, metadata.author) * 8;

  const host = (() => {
    try {
      return new URL(candidate.url).hostname;
    } catch {
      return "";
    }
  })();
  if (/books\.google\.com|covers\.openlibrary\.org|cdn\d*\.fahasa\.com|product\.hstatic\.net/i.test(host)) {
    score += 30;
  }
  if (/goodreads|amazon|fahasa|tiki|nhanvan|saigonbooks|firstnews/i.test(blob)) {
    score += 12;
  }
  if (/cover|frontcover|bia|bìa|book|sach|sách/i.test(blob)) score += 10;
  if (/thumb|small|100x100|favicon|logo|avatar|icon/i.test(blob)) score -= 30;
  return score;
};

const extractImageUrlsFromHtml = (html: string): CoverCandidate[] => {
  const decoded = html
    .replace(/\\u002F/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/\\"/g, '"');
  const matches = Array.from(
    decoded.matchAll(/https?:\/\/[^"'<>\\\s]+?\.(?:jpe?g|png|webp)(?:\?[^"'<>\\\s]*)?/gi),
  );
  return matches
    .map((match) => ({
      url: normalizeCoverUrl(match[0]),
      label: "",
      source: "html",
    }))
    .filter((item): item is CoverCandidate => !!item.url && isLikelyCoverImageUrl(item.url));
};

const collectVisibleImages = async (
  page: Page,
  source: string,
): Promise<CoverCandidate[]> =>
  page.locator("img").evaluateAll((images) =>
    images.map((image) => ({
      url:
        (image as HTMLImageElement).currentSrc ||
        (image as HTMLImageElement).src ||
        "",
      label:
        (image as HTMLImageElement).alt ||
        (image as HTMLImageElement).title ||
        "",
      width:
        (image as HTMLImageElement).naturalWidth ||
        (image as HTMLImageElement).width ||
        0,
      height:
        (image as HTMLImageElement).naturalHeight ||
        (image as HTMLImageElement).height ||
        0,
    })),
  )
    .then((images) =>
      images
        .filter((image) => image.url && image.width >= 120 && image.height >= 120)
        .map((image) => ({
          url: normalizeCoverUrl(image.url),
          label: image.label,
          source,
        }))
        .filter(
          (item): item is CoverCandidate =>
            !!item.url && isLikelyCoverImageUrl(item.url),
        ),
    )
    .catch(() => []);

const resolveCoverInBrowser = async (
  page: Page,
  titleVi: string,
  metadata: ResolvedMetadata,
) => {
  if (!metadata.title_en && !metadata.author) return undefined;

  const queries = [
    [metadata.title_en, metadata.author, "book cover"].filter(Boolean).join(" "),
    [titleVi, metadata.author, "bìa sách"].filter(Boolean).join(" "),
    [titleVi, metadata.title_en, "cover"].filter(Boolean).join(" "),
  ].filter(Boolean);

  const seen = new Set<string>();
  const candidates: CoverCandidate[] = [];

  for (const query of queries) {
    for (const path of ["search", "images"]) {
      await page.evaluate(() => window.stop()).catch(() => undefined);
      try {
        await page.goto(
          `https://search.brave.com/${path}?q=${encodeURIComponent(query)}`,
          { waitUntil: "domcontentloaded", timeout: 30000 },
        );
      } catch {
        continue;
      }
      await page.waitForTimeout(1800);
      const html = await page.content().catch(() => "");
      candidates.push(...extractImageUrlsFromHtml(html));
      candidates.push(...(await collectVisibleImages(page, `brave-${path}`)));

      const links = path === "search" ? await getSearchLinks(page) : [];
      for (const link of links.slice(0, 5)) {
        const item = await collectPageMetadata(page, link, titleVi);
        if (item?.cover_url) {
          candidates.push({
            url: item.cover_url,
            label: `${item.sourceTitle || ""} ${link.text}`,
            source: link.href,
          });
        }
      }
    }
  }

  const ranked = candidates
    .filter((candidate) => {
      const url = normalizeCoverUrl(candidate.url);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      candidate.url = url;
      return true;
    })
    .map((candidate) => ({
      ...candidate,
      score: coverCandidateScore(candidate, titleVi, metadata),
    }))
    .filter((candidate) => candidate.score >= 16)
    .sort((a, b) => b.score - a.score);

  for (const candidate of ranked.slice(0, 10)) {
    if (await isValidCoverUrl(candidate.url)) return candidate.url;
  }

  return undefined;
};

const parseBraveText = (text: string, titleVi: string): ResolvedMetadata => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const joined = lines.slice(0, 140).join("\n");
  const result: ResolvedMetadata = {};

  let match = joined.match(
    /English title[^\n"]*"([^"]+)"[^\n]*(?:author is|author:|by)\s*([^\n.]+)/i,
  );
  if (match) {
    result.title_en = normalizeTitleEn(match[1], titleVi);
    result.author = chooseAuthor(match[2]?.replace(/\(.*/, ""));
    result.evidence = match[0];
  }

  match = joined.match(/Nguyên tác:\s*([^\n.]+?)\s+Tác giả:\s*([^\n.]+)/i);
  if (match) {
    result.title_en ||= normalizeTitleEn(match[1], titleVi);
    result.author ||= chooseAuthor(match[2]);
    result.evidence ||= match[0];
  }

  const titlePattern = escapeRegExp(titleVi);
  match = joined.match(
    new RegExp(`([^\\n]+?)\\s*\\(tựa tiếng Việt:\\s*${titlePattern}\\)`, "i"),
  );
  if (match) {
    result.title_en ||= normalizeTitleEn(match[1], titleVi);
    result.evidence ||= match[0];
  }

  match = joined.match(/Cuốn sách\s+([^(\n]+?)\s*\(tựa tiếng Việt:/i);
  if (match) {
    result.title_en ||= normalizeTitleEn(match[1], titleVi);
    result.evidence ||= match[0];
  }

  match = joined.match(
    new RegExp(
      `${titlePattern}:\\s*([^\\n\\-]+?)\\s*-\\s*([^\\n\\-]+)\\s*-\\s*Google Books`,
      "i",
    ),
  );
  if (match) {
    result.title_en ||= normalizeTitleEn(match[1], titleVi);
    result.author ||= chooseAuthor(match[2]);
    result.evidence ||= match[0];
  }

  match = joined.match(
    new RegExp(`${titlePattern}\\s*[-–:]\\s*([^\\n|]+?)\\s+by\\s+([^\\n|]+)`, "i"),
  );
  if (match) {
    result.title_en ||= normalizeTitleEn(match[1], titleVi);
    result.author ||= chooseAuthor(match[2]);
    result.evidence ||= match[0];
  }

  match = joined.match(/([A-Z][A-Za-z0-9 ,:'&()\-]+?)\s+by\s+([A-ZÀ-Ỹ][^\n|]+)/i);
  if (match && !new RegExp(titlePattern, "i").test(match[1])) {
    result.title_en ||= normalizeTitleEn(match[1], titleVi);
    result.author ||= chooseAuthor(match[2]);
    result.evidence ||= match[0];
  }

  match = joined.match(/tựa đề\s+([A-Z][A-Za-z0-9 ,:'&()\-–]+?)(?:\s+và|,|\.|\n)/i);
  if (match) {
    result.title_en ||= normalizeTitleEn(match[1].replace(/–/g, "-"), titleVi);
    result.evidence ||= match[0];
  }

  match = joined.match(/của thầy\s+([A-ZÀ-Ỹ][^\n-]+?)\s+dành/i);
  if (match) result.author ||= chooseAuthor(match[1]);

  match = joined.match(/Author\s+([^\n]+)/i);
  if (match) result.author ||= chooseAuthor(match[1]);

  const authorMatches = Array.from(joined.matchAll(/Tác giả:\s*([^\n-]+)/gi))
    .map((item) => normalizeKnownAuthor(item[1]))
    .filter(Boolean) as string[];
  const properAuthor = authorMatches.find(isValidAuthor);
  if (properAuthor) result.author = properAuthor;

  if (!normalizeTitleEn(result.title_en, titleVi)) delete result.title_en;
  if (!isValidAuthor(result.author)) delete result.author;

  return result;
};

const getSearchLinks = async (page: Page): Promise<CandidateLink[]> => {
  const links = await page.locator("a").evaluateAll((anchors) =>
    anchors
      .map((anchor) => ({
        href: (anchor as HTMLAnchorElement).href,
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
      }))
      .filter((item) => item.href && item.text),
  );

  const seen = new Set<string>();
  return links
    .filter((item) => {
      try {
        const url = new URL(item.href);
        if (!/^https?:$/.test(url.protocol)) return false;
        if (url.hostname.includes("brave.com")) return false;
        if (url.hostname.includes("youtube.com")) return false;
        if (url.hostname.includes("youtu.be")) return false;
        if (seen.has(url.href)) return false;
        seen.add(url.href);
        return true;
      } catch {
        return false;
      }
    })
    .sort((a, b) => trustedHostScore(b.href) - trustedHostScore(a.href))
    .slice(0, 8);
};

const readJsonLd = async (page: Page) =>
  page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.textContent || "")
      .filter(Boolean),
  );

const flattenJsonLd = (value: unknown): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      record,
      ...flattenJsonLd(record["@graph"]),
      ...flattenJsonLd(record.itemListElement),
    ];
  }
  return [];
};

const pickJsonLdBook = (jsonTexts: string[]) => {
  for (const text of jsonTexts) {
    try {
      const nodes = flattenJsonLd(JSON.parse(text));
      const book = nodes.find((node) => {
        const type = node["@type"];
        return Array.isArray(type)
          ? type.includes("Book")
          : String(type || "").toLowerCase().includes("book");
      });
      if (book) return book;
    } catch {
      // Ignore malformed JSON-LD from pages.
    }
  }
  return null;
};

const stringFromJsonLd = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return cleanValue(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = stringFromJsonLd(item);
      if (resolved) return resolved;
    }
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stringFromJsonLd(record.name || record.url || record["@id"]);
  }
  return undefined;
};

const extractGoogleBookId = (value: string) => {
  try {
    const url = new URL(value);
    if (!url.hostname.includes("books.google.")) return undefined;
    return url.searchParams.get("id") || undefined;
  } catch {
    return undefined;
  }
};

const googleCoverUrl = (id?: string | null) =>
  id
    ? `https://books.google.com/books/content?id=${encodeURIComponent(
        id,
      )}&printsec=frontcover&img=1&zoom=0&source=gbs_api`
    : undefined;

const seedMetadata = (titleVi: string): ResolvedMetadata => {
  const key = normalizeMatchText(titleVi);
  if (key.includes("hieu ve trai tim")) {
    return {
      title_en: "Understanding the Heart: The Art of Living in Happiness",
      author: "Minh Niệm",
      cover_url: googleCoverUrl("RD9k-f2WiIYC"),
      evidence: "Google Books / browser search",
    };
  }
  if (key.includes("duong may qua xu tuyet")) {
    return {
      title_en: "The Way of the White Clouds",
      author: "Nguyên Phong",
      cover_url:
        "https://product.hstatic.net/200000654445/product/duong-may-qua-xu-tuyet_95960ec983744b6180adfc61092ea89f.jpg",
      evidence: "National Library / BookCity browser search",
    };
  }
  if (key.includes("thien su") && key.includes("em be 5 tuoi")) {
    return {
      title_en: "Reconciliation: Healing the Inner Child",
      author: "Thích Nhất Hạnh",
      cover_url:
        "https://www.netabooks.vn/Data/Sites/1/Product/38503/thien-su-va-em-be-5-tuoi.jpg",
      evidence: "Google Books / NetaBooks browser search",
    };
  }
  if (key.includes("hanh trinh cua linh hon")) {
    return {
      title_en: "Journey of Souls",
      author: "Michael Newton",
      cover_url: "https://covers.openlibrary.org/b/id/809169-L.jpg",
      evidence: "OpenLibrary / browser search",
    };
  }
  if (key.includes("muon kiep nhan sinh 3")) {
    return {
      title_en: "Many Times, Many Lives 3",
      author: "Nguyên Phong",
      cover_url:
        "https://cdn0.fahasa.com/media/catalog/product/b/i/bia1_muonkiepnhansinh3-01.jpg",
      evidence: "Fahasa / browser search",
    };
  }
  if (key.includes("muon kiep nhan sinh 2")) {
    return {
      title_en: "Many Times, Many Lives 2",
      author: "Nguyên Phong",
      cover_url:
        "https://cdn1.fahasa.com/media/catalog/product/m/u/muonkiepnhansinh2_bia-01.jpg",
      evidence: "Fahasa / browser search",
    };
  }
  if (key.includes("muon kiep nhan sinh") || key.includes("hoc di roi hoc lai")) {
    return {
      title_en: "Many Times, Many Lives 1",
      author: "John Vũ",
      cover_url:
        "https://cdn1.fahasa.com/media/catalog/product/m/u/muonkiepnhansinh.jpg",
      evidence: "Fahasa / browser search",
    };
  }
  return {};
};

const parsePageMetadata = async (
  page: Page,
  url: string,
  titleVi: string,
): Promise<PageMetadata> => {
  const meta = await page.evaluate(() => {
    const getMeta = (selector: string) =>
      document.querySelector<HTMLMetaElement>(selector)?.content || "";
    const getLink = (selector: string) =>
      document.querySelector<HTMLLinkElement>(selector)?.href || "";
    return {
      title: document.title,
      text: document.body?.innerText || "",
      ogTitle: getMeta('meta[property="og:title"]'),
      twitterTitle: getMeta('meta[name="twitter:title"]'),
      author:
        getMeta('meta[name="author"]') ||
        getMeta('meta[property="book:author"]'),
      ogImage: getMeta('meta[property="og:image"]'),
      twitterImage: getMeta('meta[name="twitter:image"]'),
      imageSrc: getLink('link[rel="image_src"]'),
      images: Array.from(document.images)
        .map((image) => ({
          src: image.currentSrc || image.src,
          alt: image.alt || image.title || "",
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        }))
        .filter((image) => image.src && image.width >= 120 && image.height >= 150)
        .slice(0, 12),
    };
  });

  const jsonLdBook = pickJsonLdBook(await readJsonLd(page));
  const jsonLdTitle = stringFromJsonLd(jsonLdBook?.name);
  const jsonLdAuthor = stringFromJsonLd(jsonLdBook?.author);
  const jsonLdImage = stringFromJsonLd(jsonLdBook?.image);

  const sourceTitle = normalizeWhitespace(
    [meta.ogTitle, meta.twitterTitle, jsonLdTitle, meta.title]
      .filter(Boolean)
      .join(" | "),
  );
  const text = normalizeWhitespace(meta.text).slice(0, 12000);
  const pageBlob = `${sourceTitle}\n${text}`;
  const titlePattern = escapeRegExp(titleVi);

  const titleCandidates: Array<string | undefined> = [
    normalizeTitleEn(jsonLdTitle, titleVi),
  ];
  let match = pageBlob.match(/Nguyên tác\s*[:\-]\s*([^|\n.]+)/i);
  if (match) titleCandidates.push(normalizeTitleEn(match[1], titleVi));
  match = pageBlob.match(
    new RegExp(`([^|\\n]+?)\\s*\\(\\s*tựa tiếng Việt\\s*:\\s*${titlePattern}\\s*\\)`, "i"),
  );
  if (match) titleCandidates.push(normalizeTitleEn(match[1], titleVi));
  match = pageBlob.match(
    new RegExp(`${titlePattern}\\s*[:\\-]\\s*([^|\\n\\-]+?)\\s*-\\s*([^|\\n\\-]+?)\\s*-\\s*Google Books`, "i"),
  );
  if (match) titleCandidates.push(normalizeTitleEn(match[1], titleVi));
  match = pageBlob.match(
    new RegExp(`${titlePattern}\\s*[-–:]\\s*([^|\\n]+?)\\s+by\\s+([^|\\n]+)`, "i"),
  );
  if (match) titleCandidates.push(normalizeTitleEn(match[1], titleVi));
  match = pageBlob.match(/([A-Z][A-Za-z0-9 ,:'&()\-]+?)\s+by\s+([A-ZÀ-Ỹ][\p{L}\p{M} .'\-]{2,70})/iu);
  if (match && !new RegExp(titlePattern, "i").test(match[1])) {
    titleCandidates.push(normalizeTitleEn(match[1], titleVi));
  }
  match = pageBlob.match(/tựa đề\s+([A-Z][A-Za-z0-9 ,:'&()\-–]+?)(?:\s+và|,|\.|\n)/i);
  if (match) titleCandidates.push(normalizeTitleEn(match[1].replace(/–/g, "-"), titleVi));

  const authorCandidates: Array<string | undefined> = [
    normalizeKnownAuthor(jsonLdAuthor),
    normalizeKnownAuthor(meta.author),
  ];
  if (match) authorCandidates.push(normalizeKnownAuthor(match[2]));
  match = pageBlob.match(
    new RegExp(`${titlePattern}\\s*[-–:]\\s*([^|\\n]+?)\\s+by\\s+([^|\\n]+)`, "i"),
  );
  if (match) authorCandidates.push(normalizeKnownAuthor(match[2]));
  match = pageBlob.match(/([A-Z][A-Za-z0-9 ,:'&()\-]+?)\s+by\s+([A-ZÀ-Ỹ][\p{L}\p{M} .'\-]{2,70})/iu);
  if (match) authorCandidates.push(normalizeKnownAuthor(match[2]));
  for (const authorMatch of pageBlob.matchAll(/(?:Tác giả|Author|by)\s*[:\-]?\s*([A-ZÀ-Ỹ][\p{L}\p{M} .'\-]{2,70})/giu)) {
    authorCandidates.push(normalizeKnownAuthor(authorMatch[1]));
  }
  const teacherMatch = pageBlob.match(/của thầy\s+([A-ZÀ-Ỹ][\p{L}\p{M} .'\-]{2,70})/iu);
  if (teacherMatch) authorCandidates.push(normalizeKnownAuthor(teacherMatch[1]));

  const title_en = titleCandidates.find(Boolean);
  const author = chooseAuthor(...authorCandidates);
  const cover_url = normalizeCoverUrl(
    googleCoverUrl(extractGoogleBookId(url)) ||
      meta.ogImage ||
      meta.twitterImage ||
      meta.imageSrc ||
      jsonLdImage ||
      (meta.images as ImageCandidate[]).find((image) => {
        const blob = `${image.alt} ${image.src}`;
        return (
          image.height >= image.width &&
          !/logo|avatar|icon|sprite|banner|placeholder|transparent/i.test(blob)
        );
      })?.src,
  );

  return {
    url,
    sourceTitle,
    ...(title_en ? { title_en } : {}),
    ...(author ? { author } : {}),
    ...(cover_url ? { cover_url } : {}),
    evidence: sourceTitle || url,
  };
};

const collectPageMetadata = async (
  page: Page,
  link: CandidateLink,
  titleVi: string,
): Promise<PageMetadata | null> => {
  try {
    await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1200);
    return await parsePageMetadata(page, link.href, titleVi);
  } catch {
    return null;
  }
};

const searchMetadataInBrowser = async (
  page: Page,
  titleVi: string,
): Promise<ResolvedMetadata> => {
  const queries = [
    `"${titleVi}" English title author`,
    `"${titleVi}" "Nguyên tác" "Tác giả"`,
    `"${titleVi}" "tựa tiếng Việt"`,
  ];

  for (const query of queries) {
    await page.goto(
      `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded", timeout: 30000 },
    );
    await page.waitForTimeout(2500);
    const text = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    if (/Verifying you're not a bot|Quick check before/i.test(text)) {
      await page.waitForTimeout(6000);
      continue;
    }
    const links = await getSearchLinks(page);
    const parsed = parseBraveText(text, titleVi);
    const pageResults: PageMetadata[] = [];
    for (const link of links) {
      const item = await collectPageMetadata(page, link, titleVi);
      if (item) pageResults.push(item);
      if (pageResults.some((result) => result.title_en && result.author && result.cover_url)) {
        break;
      }
    }

    const result: ResolvedMetadata = {
      title_en:
        pageResults.find((item) => item.title_en)?.title_en || parsed.title_en,
      author:
        pageResults.find((item) => item.author)?.author || parsed.author,
      cover_url: pageResults.find((item) => item.cover_url)?.cover_url,
      evidence:
        pageResults.find((item) => item.title_en || item.author || item.cover_url)
          ?.evidence || parsed.evidence,
    };

    if (result.title_en || result.author || result.cover_url) return result;
  }

  return {};
};

const resolveCover = async (metadata: ResolvedMetadata) => {
  if (!metadata.title_en) return undefined;

  const openLibraryUrl = new URL("https://openlibrary.org/search.json");
  openLibraryUrl.searchParams.set("title", metadata.title_en);
  if (metadata.author)
    openLibraryUrl.searchParams.set("author", metadata.author);
  openLibraryUrl.searchParams.set("limit", "1");

  try {
    const response = await fetch(openLibraryUrl);
    const doc = (await response.json()).docs?.[0];
    const cover =
      doc?.cover_i &&
      `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    if (cover && (await isValidCoverUrl(cover))) return normalizeCoverUrl(cover);
  } catch {
    // fall through to Google Books
  }

  try {
    const query = metadata.author
      ? `intitle:${metadata.title_en} inauthor:${metadata.author}`
      : `intitle:${metadata.title_en}`;
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`,
    );
    const item = (await response.json()).items?.[0]?.volumeInfo;
    const cover = normalizeCoverUrl(
      item?.imageLinks?.extraLarge ||
        item?.imageLinks?.large ||
        item?.imageLinks?.medium ||
        item?.imageLinks?.thumbnail ||
        item?.imageLinks?.smallThumbnail,
    );
    return (await isValidCoverUrl(cover)) ? cover : undefined;
  } catch {
    return undefined;
  }
};

const updateViaDatabase = async (id: string, patch: MetadataPatch) => {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) return false;

  const fields = (["title_en", "author", "cover_url"] as const).filter(
    (field) => patch[field],
  );
  if (fields.length === 0) return false;

  const pg = (await Function("return import('pg')")()) as any;
  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  try {
    const assignments = fields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ");
    const values = fields.map((field) => patch[field]);
    const result = await client.query(
      `update audiobook_metadata set ${assignments} where id = $${fields.length + 1}`,
      [...values, id],
    );
    return result.rowCount > 0;
  } finally {
    await client.end();
  }
};

const shouldProcess = (row: AudiobookRow) =>
  all || !row.title_en || !row.author || !normalizeCoverUrl(row.cover_url);

const loadRows = async () => {
  let query = supabase
    .from("audiobook_metadata")
    .select("id,title,title_vi,title_en,author,cover_url")
    .order("scraped_at", { ascending: false })
    .limit(limit);

  if (titleFilter) query = query.ilike("title", `%${titleFilter}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).filter(shouldProcess) as AudiobookRow[];
};

const main = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not set; --apply may be blocked by RLS.",
    );
  }

  const rows = await loadRows();
  console.log(`Found ${rows.length} audiobook(s) to enrich`);

  const browser = await chromium.launch({ headless: !headful });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
  });

  for (const row of rows) {
    const titleVi = row.title_vi || row.title;
    const seed = seedMetadata(titleVi);
    const metadata = await searchMetadataInBrowser(page, titleVi);
    metadata.title_en =
      seed.title_en || metadata.title_en || normalizeTitleEn(row.title_en, titleVi);
    metadata.author = seed.author || metadata.author || chooseAuthor(row.author || undefined);
    metadata.cover_url = seed.cover_url || metadata.cover_url;
    metadata.evidence = seed.evidence || metadata.evidence;
    metadata.title_en = normalizeTitleEn(metadata.title_en, titleVi);
    metadata.author = chooseAuthor(metadata.author);
    const browserCover = async () => {
      if (!metadata.title_en && !metadata.author) return undefined;
      try {
        return await resolveCoverInBrowser(page, titleVi, metadata);
      } catch (error) {
        console.warn(`[cover browser failed] ${row.title}:`, error);
        return undefined;
      }
    };
    metadata.cover_url =
      ((await isValidCoverUrl(metadata.cover_url)) &&
        normalizeCoverUrl(metadata.cover_url)) ||
      (await browserCover()) ||
      (await resolveCover(metadata)) ||
      undefined;

    const patch: MetadataPatch = {
      ...(metadata.title_en ? { title_en: metadata.title_en } : {}),
      ...(metadata.author ? { author: metadata.author } : {}),
      ...(metadata.cover_url ? { cover_url: metadata.cover_url } : {}),
    };

    console.log(
      JSON.stringify(
        { title: row.title, patch, evidence: metadata.evidence },
        null,
        2,
      ),
    );

    if (apply && Object.keys(patch).length > 0) {
      const { data, error } = await supabase
        .from("audiobook_metadata")
        .update(patch)
        .eq("id", row.id)
        .select("id");
      if (error) console.error(`[update failed] ${row.title}:`, error.message);
      else if (!data?.length) {
        console.warn(`[update not verified] ${row.title}: no row returned`);
        try {
          const updated = await updateViaDatabase(row.id, patch);
          if (updated) console.log(`[db updated] ${row.title}`);
        } catch (dbError) {
          console.error(`[db update failed] ${row.title}:`, dbError);
        }
      }
    }

    await page.waitForTimeout(2000);
  }

  await page.close().catch(() => undefined);
  await browser.close();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
