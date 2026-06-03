import {
  getBookCoverCandidates,
  normalizeCoverUrl,
  resolveAudiobookCoverUrl,
  resolveBookCoverUrl,
} from "../../src/core/mediaAssets";

describe("mediaAssets", () => {
  it("keeps curated book cover before generated provider fallbacks", () => {
    const book = {
      isbn: "978-604-1-23456-7",
      cover_url: "http://cdn.example.com/book.jpg",
      google_data: {
        imageLinks: {
          thumbnail: "http://books.google.com/books/content?id=abc&zoom=1",
        },
      },
    };

    const candidates = getBookCoverCandidates(book);

    expect(candidates[0]).toBe("https://cdn.example.com/book.jpg");
    expect(candidates[candidates.length - 1]).toBe(
      "https://covers.openlibrary.org/b/isbn/9786041234567-L.jpg?default=false",
    );
  });

  it("normalizes Google thumbnail URLs for higher-resolution cached images", () => {
    expect(
      normalizeCoverUrl(
        "http://books.google.com/books/content?id=abc&printsec=frontcover&imgtk=token&zoom=2&edge=curl",
      ),
    ).toBe(
      "https://books.google.com/books/content?id=abc&printsec=frontcover&zoom=0",
    );
  });

  it("keeps Google frontcover params while removing placeholder-prone sizing", () => {
    expect(
      normalizeCoverUrl(
        "http://books.google.com/books/content?id=u2ErDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api&w=1200",
      ),
    ).toBe(
      "https://books.google.com/books/content?id=u2ErDwAAQBAJ&printsec=frontcover&img=1&zoom=0&source=gbs_api",
    );
  });

  it("resolves audiobook covers from canonical metadata before fallback", () => {
    const audiobook = {
      id: "audio-1",
      cover_url: "https://cdn.example.com/audio-small.jpg",
      canonical_cover_url: "https://cdn.example.com/audio-large.jpg",
    };

    expect(resolveAudiobookCoverUrl(audiobook)).toBe(
      "https://cdn.example.com/audio-large.jpg",
    );
  });

  it("returns the provided fallback when no remote cover exists", () => {
    expect(resolveBookCoverUrl({ title: "No Cover" }, "fallback")).toBe(
      "fallback",
    );
  });

  it("drops broken Tiki cached cover URLs so audiobook cards can fall back", () => {
    expect(
      normalizeCoverUrl(
        "https://salt.tikicdn.com/cache/w1200/ts/product/49/71/34/bad.jpg",
      ),
    ).toBeUndefined();
  });
});
