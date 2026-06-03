import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import MemberHome from "../../app/(member)/index";

let mockBooks: any[] = [];

jest.mock("../../src/hooks/useLibrary", () => ({
  useLibrary: () => ({
    books: {
      list: () => ({ data: mockBooks, isLoading: false }),
    },
    borrows: {
      list: () => ({ data: [], isLoading: false }),
    },
    recommendations: {
      interests: () => ({ data: [], isLoading: false }),
      get: () => ({ data: [], isLoading: false }),
    },
    feed: {
      getCommunityFeed: () => ({ data: [], isLoading: false }),
    },
    stats: {
      activeCount: 0,
      totalFine: 0,
      hasOverdue: false,
    },
    getCollection: (_name: string, limit: number) => mockBooks.slice(0, limit),
  }),
  useInteractions: () => ({ data: [], refetch: jest.fn() }),
}));

jest.mock("../../src/hooks/useBroadcast", () => ({
  useBroadcast: () => ({ latestMessage: null, dismissLatest: jest.fn() }),
}));

jest.mock("../../src/hooks/useConnectivity", () => ({
  useConnectivity: () => ({
    isOnline: true,
    isSyncing: false,
    triggerSync: jest.fn(),
  }),
}));

jest.mock("../../src/hooks/useGamification", () => ({
  useGamification: () => ({
    points: 0,
    level: 1,
    currentLevelXP: 0,
    nextLevelXP: 100,
  }),
}));

jest.mock("../../src/features/members/member-service", () => ({
  membersService: {
    getActionQueue: jest.fn().mockResolvedValue([]),
    getBorrows: jest.fn().mockResolvedValue([]),
    getBooks: jest.fn().mockResolvedValue([]),
    getBorrowRecords: jest.fn().mockResolvedValue([]),
    saveBooks: jest.fn().mockResolvedValue(undefined),
    saveBorrows: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../src/core/sync", () => ({
  sync: {
    getQueue: jest.fn().mockResolvedValue([]),
    onQueueChange: jest.fn(() => jest.fn()),
  },
}));

const makeBook = (overrides = {}) => ({
  id: "book-1",
  isbn: "9780000000001",
  title: "Clean Architecture",
  author: "Robert C. Martin",
  category: "Computers",
  total_copies: 3,
  available_copies: 2,
  cover_url: null,
  ...overrides,
});

const renderMemberHome = async () => {
  const result = render(<MemberHome />);
  await act(async () => {
    await Promise.resolve();
  });
  return result;
};

describe("MemberHome Screen", () => {
  beforeEach(() => {
    mockBooks = [];
    jest.clearAllMocks();
  });

  it("renders books from the library kernel", async () => {
    mockBooks = [makeBook()];

    await renderMemberHome();

    await waitFor(() => {
      expect(screen.getAllByText("Clean Architecture").length).toBeGreaterThan(
        0,
      );
      expect(screen.getAllByText("Robert C. Martin").length).toBeGreaterThan(0);
    });
  });

  it("renders multiple books without requiring Supabase query mocks", async () => {
    mockBooks = [
      makeBook(),
      makeBook({
        id: "book-2",
        isbn: "9780000000002",
        title: "Domain-Driven Design",
        author: "Eric Evans",
      }),
    ];

    await renderMemberHome();

    await waitFor(() => {
      expect(screen.getAllByText("Clean Architecture").length).toBeGreaterThan(
        0,
      );
      expect(
        screen.getAllByText("Domain-Driven Design").length,
      ).toBeGreaterThan(0);
    });
  });

  it("does not crash when the kernel returns no books", async () => {
    mockBooks = [];

    await expect(renderMemberHome()).resolves.toBeTruthy();
  });
});
