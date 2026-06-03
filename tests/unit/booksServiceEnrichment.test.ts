import axios from "axios";
import { booksService } from "../../src/features/books/books.service";
import { supabase } from "../../src/api/supabase";

describe("booksService enrichment", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fills missing book cover metadata from ISBN sources", async () => {
    const fetchBookMetadata = jest
      .spyOn(booksService, "fetchBookMetadata")
      .mockResolvedValue({
        title: "The C Programming Language",
        author: "Brian Kernighan, Dennis Ritchie",
        description: "A classic programming book.",
        publishedDate: "1988",
        categories: ["Computers"],
        thumbnail:
          "http://books.google.com/books/content?id=abc&zoom=2&edge=curl",
        isbn: "9780131103627",
        language: "en",
        averageRating: 4.7,
        ratingsCount: 1200,
        edition: "2",
      });
    const searchMetadata = jest
      .spyOn(booksService, "fetchMetadataBySearch")
      .mockResolvedValue(null);

    const payload = await booksService.enrichBookPayload({
      title: "Manual title",
      author: "",
      isbn: "ISBN: 978-0-13-110362-7",
      total_copies: 2,
      cover_url: null,
      category: null,
      description: null,
    });

    expect(fetchBookMetadata).toHaveBeenCalledWith("9780131103627");
    expect(searchMetadata).not.toHaveBeenCalled();
    expect(payload.title).toBe("Manual title");
    expect(payload.author).toBe("Brian Kernighan, Dennis Ritchie");
    expect(payload.isbn).toBe("9780131103627");
    expect(payload.category).toBe("Computers");
    expect(payload.cover_url).toBe(
      "https://books.google.com/books/content?id=abc&zoom=0&printsec=frontcover",
    );
  });

  it("keeps existing book metadata and only normalizes the cover url", async () => {
    const fetchBookMetadata = jest
      .spyOn(booksService, "fetchBookMetadata")
      .mockResolvedValue(null);

    const payload = await booksService.enrichBookPayload({
      title: "Existing title",
      author: "Existing author",
      isbn: "9786041234567",
      cover_url: "http://covers.openlibrary.org/b/isbn/9786041234567-M.jpg",
      category: "Fiction",
      description: "Already curated.",
    });

    expect(fetchBookMetadata).not.toHaveBeenCalled();
    expect(payload.title).toBe("Existing title");
    expect(payload.author).toBe("Existing author");
    expect(payload.cover_url).toBe(
      "https://covers.openlibrary.org/b/isbn/9786041234567-L.jpg",
    );
  });

  it("fills missing audiobook cover metadata by title search", async () => {
    const fetchBookMetadata = jest
      .spyOn(booksService, "fetchBookMetadata")
      .mockResolvedValue(null);
    const searchMetadata = jest
      .spyOn(booksService, "fetchMetadataBySearch")
      .mockResolvedValue({
        title: "Dune",
        author: "Frank Herbert",
        description: "A desert planet epic.",
        thumbnail: "https://covers.openlibrary.org/b/id/42-M.jpg",
        categories: ["Science Fiction"],
      });

    const payload = await booksService.enrichAudiobookPayload({
      title: "Dune",
      author: "",
      cover_url: null,
      description: null,
      source_platform: "r2",
      source_id: "audio/dune.mp3",
    });

    expect(fetchBookMetadata).not.toHaveBeenCalled();
    expect(searchMetadata).toHaveBeenCalledWith("Dune", "", "Dune");
    expect(payload.source_platform).toBe("r2");
    expect(payload.author).toBe("Frank Herbert");
    expect(payload.categories).toBeUndefined();
    expect(payload.cover_url).toBe(
      "https://covers.openlibrary.org/b/id/42-L.jpg",
    );
  });

  it("forces audiobook metadata from a matching canonical book title", async () => {
    const fromMock = supabase.from as jest.Mock;
    const update = jest.fn(() => ({ eq: jest.fn() }));

    fromMock.mockImplementation((table: string) => {
      if (table === "books") {
        const builder: any = {
          select: jest.fn(() =>
            Promise.resolve({
              data: [
                {
                  isbn: "9781567184853",
                  title: "Journey of Souls",
                  title_vi: "Journey of Souls",
                  title_en: null,
                  author: "Michael Newton",
                  description: "Canonical book description.",
                  description_en: null,
                  description_vi: null,
                  cover_url: "https://covers.openlibrary.org/b/id/809168-L.jpg",
                  category: "Body, Mind & Spirit",
                },
              ],
              error: null,
            }),
          ),
        };
        return builder;
      }

      return {
        update,
      };
    });

    const [item] = await booksService.enrichWithBookMetadata(
      [
        {
          id: "audio-journey",
          source_platform: "thuviensachnoi",
          source_id: "hanh-trinh-cua-linh-hon",
          source_url: "https://example.com/audio.mp3",
          preview_url: null,
          title: "Hành Trình Của Linh Hồn",
          title_en: "Journey of Souls",
          title_vi: "Hành Trình Của Linh Hồn",
          author: "Wrong author",
          narrator: null,
          description: null,
          publisher: null,
          isbn: null,
          language: "vi",
          cover_url: null,
          duration_seconds: 0,
          chapters: [],
          categories: [],
          tags: null,
          price: null,
          is_free: true,
          is_premium: false,
          rating: null,
          review_count: 0,
          published_at: null,
          scraped_at: new Date().toISOString(),
        },
      ],
      true,
    );

    expect(item.canonical_author).toBe("Michael Newton");
    expect(item.isbn).toBeNull();
    expect(item.canonical_cover_url).toBe(
      "https://covers.openlibrary.org/b/id/809168-L.jpg",
    );
  });

  it("uses the Vietnamese audiobook title plus English title to replace bad imported metadata", async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "books") {
        return {
          select: jest.fn(() => Promise.resolve({ data: [], error: null })),
        };
      }
      return { update: jest.fn(() => ({ eq: jest.fn() })) };
    });

    const searchMetadata = jest
      .spyOn(booksService, "fetchMetadataBySearch")
      .mockResolvedValue({
        title: "Resolved English Title",
        author: "Resolved Author",
        thumbnail: "https://covers.openlibrary.org/b/id/99-M.jpg",
        categories: ["Mindfulness"],
      });

    const item = await booksService.enrichAudiobookPayload({
      title: "Thiền Sư Và Em Bé 5 Tuổi",
      title_en: "Reconciliation: Healing the Inner Child",
      author: "Imported Wrong Author",
      cover_url:
        "https://salt.tikicdn.com/cache/w1200/ts/product/49/71/34/bad.jpg",
      description: null,
      source_platform: "r2",
      source_id: "audio/thien-su.mp3",
    });

    expect(searchMetadata).toHaveBeenCalledWith(
      "Thiền Sư Và Em Bé 5 Tuổi",
      "",
      "Reconciliation: Healing the Inner Child",
    );
    expect(item.title).toBe("Thiền Sư Và Em Bé 5 Tuổi");
    expect(item.title_vi).toBe("Thiền Sư Và Em Bé 5 Tuổi");
    expect(item.author).toBe("Resolved Author");
    expect(item.cover_url).toBe("https://covers.openlibrary.org/b/id/99-L.jpg");
  });

  it("falls back to the R2 worker when the edge manager has no valid session", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(axios, "get").mockResolvedValue({
      data: [
        {
          key: "CHỦ NGHĨA KHẮC KỶ.mp3",
          size: 505906198,
          uploaded: "2026-05-06T11:50:39.737Z",
        },
        {
          key: "folder/01.mp3",
          size: 1024,
          uploaded: "2026-05-06T11:50:39.737Z",
        },
        {
          key: "folder/nested/02.mp3",
          size: 2048,
          uploaded: "2026-05-06T11:50:39.737Z",
        },
      ],
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        or: jest.fn(() =>
          Promise.resolve({
            data: [{ tags: ["r2_path:folder/01.mp3"] }],
            error: null,
          }),
        ),
      })),
    });

    const root = await booksService.listR2Objects("");
    expect(root.files).toEqual([
      expect.objectContaining({
        key: "CHỦ NGHĨA KHẮC KỶ.mp3",
        isImported: false,
      }),
    ]);
    expect(root.folders).toEqual([expect.objectContaining({ key: "folder/" })]);

    const folder = await booksService.listR2Objects("folder/");
    expect(folder.files).toEqual([
      expect.objectContaining({ key: "folder/01.mp3", isImported: true }),
    ]);
    expect(folder.folders).toEqual([
      expect.objectContaining({ key: "folder/nested/" }),
    ]);
  });

  it("marks R2 items imported from existing source_url/tags even when edge flags are stale", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      data: [
        {
          key: "Hiểu về trái tim.mp3",
          size: 1024,
        },
        {
          key: "đường_mây_qua_xứ_tuyết/1.mp3",
          size: 1024,
        },
      ],
    });
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        or: jest.fn(() =>
          Promise.resolve({
            data: [
              {
                source_platform: "thuviensachnoi",
                source_id: "hieu-ve-trai-tim",
                source_url:
                  "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev/Hiểu%20về%20trái%20tim.mp3",
                tags: ["r2_path:Hiểu về trái tim.mp3"],
              },
              {
                source_platform: "thuviensachnoi",
                source_id: "duong-may-qua-xu-tuyet",
                source_url:
                  "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev/đường_mây_qua_xứ_tuyết/1.mp3",
                tags: ["r2_path:đường_mây_qua_xứ_tuyết/1.mp3"],
              },
            ],
            error: null,
          }),
        ),
      })),
    });

    const root = await booksService.listR2Objects("");

    expect(root.files).toEqual([
      expect.objectContaining({
        key: "Hiểu về trái tim.mp3",
        isImported: true,
      }),
    ]);
    expect(root.folders).toEqual([
      expect.objectContaining({
        key: "đường_mây_qua_xứ_tuyết/",
        isImported: true,
      }),
    ]);
  });

  it("builds R2 metadata locally when the edge manager is unauthorized", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const searchMetadata = jest
      .spyOn(booksService, "fetchMetadataBySearch")
      .mockResolvedValue({
        title: "Resolved Title",
        author: "Resolved Author",
        thumbnail: "https://covers.openlibrary.org/b/id/12-L.jpg",
        categories: ["Philosophy"],
      });

    const metadata = await booksService.getR2Metadata("SÁCH CHƯA CÓ.mp3");

    expect(searchMetadata).toHaveBeenCalledWith("SÁCH CHƯA CÓ", "");
    expect(metadata).toEqual(
      expect.objectContaining({
        title: "SÁCH CHƯA CÓ",
        title_vi: "SÁCH CHƯA CÓ",
        title_en: "Resolved Title",
        author: "Resolved Author",
        cover_url: "https://covers.openlibrary.org/b/id/12-L.jpg",
      }),
    );
  });

  it("does not expand an explicit empty R2 path import into all root files", async () => {
    const workerList = jest.spyOn(axios, "get").mockResolvedValue({
      data: [{ key: "should-not-import.mp3", size: 1024 }],
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        in: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    });

    const result = await booksService.bulkImportR2Audiobooks({ paths: [] });

    expect(workerList).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
    expect(result.imported).toBe(0);
  });

  it("imports a single R2 file through the R2 import RPC", async () => {
    const workerList = jest.spyOn(axios, "get").mockResolvedValue({
      data: [{ key: "should-not-be-listed.mp3", size: 1024 }],
    });
    const saved = {
      id: "audio-1",
      source_platform: "r2",
      source_id: "Demo Audio.mp3",
      r2_key_normalized: "demo audio.mp3",
      title: "Demo Audio",
    };
    const lookupBuilder = {
      select: jest.fn(() => lookupBuilder),
      eq: jest.fn(() => lookupBuilder),
      limit: jest.fn(() => Promise.resolve({ data: [saved], error: null })),
    };

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: saved,
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue(lookupBuilder);

    const progress = jest.fn();
    const result = await booksService.quickImportR2AudioFile(
      "Demo Audio.mp3",
      progress,
    );

    expect(workerList).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "import_r2_audiobook",
      expect.objectContaining({
        p_path: "Demo Audio.mp3",
        p_payload: expect.objectContaining({
          source_platform: "r2",
          source_id: "Demo Audio.mp3",
        }),
      }),
    );
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ percent: 10, processed: 0, total: 1 }),
    );
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ percent: 90, processed: 0, total: 1 }),
    );
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ percent: 100, processed: 1, total: 1 }),
    );
    expect(result.total).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.audiobooks).toEqual([saved]);
  });

  it("returns minimal R2 metadata when all metadata lookups time out", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest
      .spyOn(booksService, "fetchMetadataBySearch")
      .mockReturnValue(new Promise(() => {}) as any);

    const metadataPromise = booksService.getR2Metadata(
      "hành_trình_của_linh_hồn/1.mp3",
    );

    await jest.advanceTimersByTimeAsync(12000);
    const metadata = await metadataPromise;

    expect(metadata).toEqual(
      expect.objectContaining({
        title: "hành trình của linh hồn",
        title_vi: "hành trình của linh hồn",
        source_url:
          "https://pub-387e5eaea560486daafa6d3e602ac3d8.r2.dev/h%C3%A0nh_tr%C3%ACnh_c%E1%BB%A7a_linh_h%E1%BB%93n/1.mp3",
      }),
    );
    jest.useRealTimers();
  });
});
