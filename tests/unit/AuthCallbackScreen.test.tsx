import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ code: "oauth-code" }),
  useRouter: () => ({ replace: mockReplace }),
}));

const AuthCallbackScreen = require("../../app/auth-callback").default;
const { supabase } = require("../../src/api/supabase");
const {
  syncCurrentSessionAndGetHomeRoute,
} = require("../__mocks__/auth/roleRedirect");

describe("AuthCallbackScreen", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReplace.mockReset();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it("uses the existing session route when OAuth code exchange was already handled", async () => {
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: { message: "Auth code already consumed" },
    });
    (syncCurrentSessionAndGetHomeRoute as jest.Mock).mockResolvedValue(
      "/(member)",
    );

    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(syncCurrentSessionAndGetHomeRoute).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/(member)");
    });
  });

  it("does not run the delayed login redirect after the callback screen unmounts", async () => {
    jest.useFakeTimers();
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid OAuth callback" },
    });
    (syncCurrentSessionAndGetHomeRoute as jest.Mock).mockResolvedValue(null);

    const { unmount } = render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalled();
      expect(screen.getByText("Invalid OAuth callback")).toBeTruthy();
    });

    unmount();
    jest.runOnlyPendingTimers();

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
