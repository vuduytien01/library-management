import axios from "axios";
import { fetchBookMetadata, normalizeIsbn } from "../bookService";

jest.mock("axios");
jest.mock("../../src/core/ai", () => ({
  ai: {
    translateMetadata: jest.fn(
      (title: string, description: string, author: string) =>
        Promise.resolve({
          title_en: title,
          title_vi: title,
          description_en: description,
          description_vi: description,
          author_en: author,
          author_vi: author,
        }),
    ),
  },
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("bookService", () => {
  const isbn = "9780385533225";

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("normalizeIsbn removes dashes, spaces and ISBN: prefix", () => {
    expect(normalizeIsbn("978-0-385-53322-5")).toBe("9780385533225");
    expect(normalizeIsbn("978 0 385 53322 5")).toBe("9780385533225");
    expect(normalizeIsbn("ISBN:9780385533225")).toBe("9780385533225");
  });

  test("fetchBookMetadata returns data from Google Books on success", async () => {
    const mockData = {
      data: {
        items: [
          {
            volumeInfo: {
              title: "Test Book",
              authors: ["Author A"],
              imageLinks: { thumbnail: "http://example.com/thumb.jpg" },
            },
          },
        ],
      },
    };
    mockedAxios.get.mockResolvedValueOnce(mockData);
    mockedAxios.get.mockResolvedValueOnce({ data: {} }); // OpenLib second call

    const result = await fetchBookMetadata(isbn);
    expect(result?.title).toBe("Test Book");
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("googleapis.com"),
      expect.any(Object),
    );
  });

  test("fetchBookMetadata falls back to Open Library for metadata if Google fails", async () => {
    // Google Books failure
    mockedAxios.get.mockRejectedValueOnce(new Error("Google API Error"));

    // Open Library success
    const mockOlData = {
      data: {
        [`ISBN:${isbn}`]: {
          title: "OL Book",
          authors: [{ name: "Author B" }],
          cover: { large: "http://example.com/large.jpg" },
        },
      },
    };
    mockedAxios.get.mockResolvedValueOnce(mockOlData);

    const result = await fetchBookMetadata(isbn);
    expect(result?.title).toBe("OL Book");
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  test("fetchBookMetadata returns null if both APIs fail", async () => {
    mockedAxios.get.mockRejectedValue(new Error("API Error"));

    const result = await fetchBookMetadata(isbn);
    expect(result).toBeNull();
  });
});
