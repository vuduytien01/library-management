import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useAudiobook } from "../../src/hooks/library/useContent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "../../src/api/supabase";
import React from "react";

// Mock Supabase
jest.mock("../../src/api/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock Translation
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, def: string) => def,
    i18n: { language: "vi" },
  }),
}));

// Mock booksService
jest.mock("../../src/features/books/books.service", () => ({
  booksService: {
    enrichWithBookMetadata: jest.fn((data) => Promise.resolve(data)),
  },
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("useAudiobook hook (TDD)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fails when query takes too long (Timeout)", async () => {
    jest.useFakeTimers();
    // We'll use a shorter timeout in the hook for testing if needed,
    // but here we just test that it eventually errors out.
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(
        () =>
          new Promise((resolve) => {
            // Delay resolution by 15s to trigger the 10s timeout
            setTimeout(() => resolve({ data: null, error: null }), 15000);
          }),
      ),
    });

    try {
      const { result } = renderHook(() => useAudiobook("timeout-id"), {
        wrapper,
      });

      await act(async () => {
        jest.advanceTimersByTime(10050);
        await Promise.resolve();
      });

      await waitFor(
        () => {
          if (result.current.error)
            console.log("Hook Error:", result.current.error.message);
          expect(result.current.isError).toBe(true);
        },
        { timeout: 1000 },
      );

      expect(result.current.error?.message).toBe("QUERY_TIMEOUT");
    } finally {
      jest.useRealTimers();
    }
  }, 20000);

  it("handles PERMISSION_DENIED (403/RLS)", async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: { code: "42501", message: "RLS violation" },
        status: 403,
      }),
    });

    const { result } = renderHook(() => useAudiobook("restricted-id"), {
      wrapper,
    });

    await waitFor(
      () => {
        if (result.current.error)
          console.log("Hook Error (Permission):", result.current.error.message);
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(result.current.error?.message).toBe("PERMISSION_DENIED");
  });
});
