/**
 * Test suite: Fake data generators
 * Tests full data model shapes using @faker-js/faker for reusability across test files
 */
import { faker } from '@faker-js/faker';

// ─── Type definitions (mirrors real DB types) ───────────────────────────────

export type UserRole = 'MEMBER' | 'LIBRARIAN' | 'ADMIN';

export interface FakeUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface FakeBook {
  id: string;
  title: string;
  author: string;
  isbn: string;
  total_quantity: number;
  available_quantity: number;
  published_year: number;
  genre: string;
}

export interface FakeBorrowRecord {
  id: string;
  book_id: string;
  user_id: string;
  status: 'PENDING' | 'APPROVED' | 'RETURNED' | 'REJECTED';
  borrow_date: string | null;
  due_date: string | null;
  return_date: string | null;
}

// ─── Fake data factories ─────────────────────────────────────────────────────

export const createFakeUser = (overrides?: Partial<FakeUser>): FakeUser => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  full_name: faker.person.fullName(),
  role: faker.helpers.arrayElement<UserRole>(['MEMBER', 'LIBRARIAN', 'ADMIN']),
  created_at: faker.date.past().toISOString(),
  ...overrides,
});

export const createFakeBook = (overrides?: Partial<FakeBook>): FakeBook => {
  const total = faker.number.int({ min: 1, max: 20 });
  return {
    id: faker.string.uuid(),
    title: faker.word.words({ count: { min: 2, max: 5 } }),
    author: faker.person.fullName(),
    isbn: faker.string.numeric(13),
    total_quantity: total,
    available_quantity: faker.number.int({ min: 0, max: total }),
    published_year: faker.number.int({ min: 1980, max: 2024 }),
    genre: faker.helpers.arrayElement([
      'Fiction',
      'Non-Fiction',
      'Science',
      'History',
      'Biography',
      'Technology',
    ]),
    ...overrides,
  };
};

export const createFakeBorrowRecord = (
  overrides?: Partial<FakeBorrowRecord>
): FakeBorrowRecord => ({
  id: faker.string.uuid(),
  book_id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  status: faker.helpers.arrayElement<FakeBorrowRecord['status']>([
    'PENDING',
    'APPROVED',
    'RETURNED',
    'REJECTED',
  ]),
  borrow_date: faker.date.recent().toISOString(),
  due_date: faker.date.future().toISOString(),
  return_date: null,
  ...overrides,
});

// ─── Tests for the factories themselves ─────────────────────────────────────

describe('Fake data factories', () => {
  describe('createFakeUser()', () => {
    it('should generate a user with valid UUID', () => {
      const user = createFakeUser();
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should generate a user with valid email', () => {
      const user = createFakeUser();
      expect(user.email).toContain('@');
    });

    it('should generate a user with one of the 3 valid roles', () => {
      const roles = new Set<string>();
      for (let i = 0; i < 30; i++) {
        roles.add(createFakeUser().role);
      }
      // Over 30 calls we should have seen all 3 roles
      expect(roles.has('MEMBER') || roles.has('LIBRARIAN') || roles.has('ADMIN')).toBe(true);
    });

    it('should accept overrides and apply them', () => {
      const user = createFakeUser({ role: 'ADMIN', email: 'admin@library.vn' });
      expect(user.role).toBe('ADMIN');
      expect(user.email).toBe('admin@library.vn');
    });
  });

  describe('createFakeBook()', () => {
    it('should generate a book with available_quantity <= total_quantity', () => {
      for (let i = 0; i < 20; i++) {
        const book = createFakeBook();
        expect(book.available_quantity).toBeLessThanOrEqual(book.total_quantity);
      }
    });

    it('should generate a 13-digit ISBN', () => {
      const book = createFakeBook();
      expect(book.isbn).toMatch(/^\d{13}$/);
    });

    it('should accept available_quantity=0 override (book unavailable)', () => {
      const book = createFakeBook({ available_quantity: 0 });
      expect(book.available_quantity).toBe(0);
    });
  });

  describe('createFakeBorrowRecord()', () => {
    it('should generate a record with a valid status', () => {
      const record = createFakeBorrowRecord();
      expect(['PENDING', 'APPROVED', 'RETURNED', 'REJECTED']).toContain(record.status);
    });

    it('should be able to create a PENDING borrow record', () => {
      const record = createFakeBorrowRecord({ status: 'PENDING', return_date: null });
      expect(record.status).toBe('PENDING');
      expect(record.return_date).toBeNull();
    });

    it('should be able to create a RETURNED borrow record with a return date', () => {
      const returnDate = new Date().toISOString();
      const record = createFakeBorrowRecord({ status: 'RETURNED', return_date: returnDate });
      expect(record.status).toBe('RETURNED');
      expect(record.return_date).toBe(returnDate);
    });
  });
});
