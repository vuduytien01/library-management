import { booksService } from "../../src/features/books/books.service";

export const normalizeIsbn = (isbn: string) => booksService.normalizeIsbn(isbn);

export const fetchBookMetadata = (isbn: string) =>
  booksService.fetchBookMetadata(isbn);
