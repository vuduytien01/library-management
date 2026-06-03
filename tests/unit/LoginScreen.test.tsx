import { faker } from "@faker-js/faker";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import LoginScreen from "../../app/(auth)/login";
import { supabase } from "../api/supabase";
import { signInWithOAuthProvider } from "../auth/oauth";
import { useAuthStore } from "../store/useAuthStore";

jest.mock("../auth/oauth", () => ({
  completeAuthSession: jest.fn(),
  signInWithOAuthProvider: jest.fn(),
}));

const { __routerMock } = require("expo-router");
const loginButton = () => screen.getAllByText("Đăng nhập").at(-1)!;

beforeEach(() => {
  __routerMock.push.mockReset();
  __routerMock.replace.mockReset();
  __routerMock.back.mockReset();

  useAuthStore.setState({
    session: null,
    profile: null,
    loading: false,
    initialized: false,
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("LoginScreen", () => {
  describe("rendering", () => {
    it("should render the Vietnamese welcome title", () => {
      render(<LoginScreen />);
      expect(screen.getAllByText("Đăng nhập").length).toBeGreaterThan(0);
    });

    it("should render email input", () => {
      render(<LoginScreen />);
      expect(screen.getByPlaceholderText("email@bv-du.com")).toBeTruthy();
    });

    it("should render password input", () => {
      render(<LoginScreen />);
      expect(screen.getByPlaceholderText("••••••••")).toBeTruthy();
    });

    it("navigates to grouped signup route when signup CTA is pressed", () => {
      render(<LoginScreen />);

      fireEvent.press(screen.getByText("Đăng ký ngay"));

      expect(__routerMock.push).toHaveBeenCalledWith("/(auth)/signup");
    });
  });

  describe("input interaction", () => {
    it("should update email input when user types", () => {
      const fakeEmail = faker.internet.email();
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText("email@bv-du.com");
      fireEvent.changeText(emailInput, fakeEmail);

      expect(emailInput.props.value).toBe(fakeEmail);
    });

    it("should accept multiple character email addresses", () => {
      render(<LoginScreen />);
      const emailInput = screen.getByPlaceholderText("email@bv-du.com");

      fireEvent.changeText(emailInput, "a");
      fireEvent.changeText(emailInput, "ab");
      fireEvent.changeText(emailInput, "ab@test.com");

      expect(emailInput.props.value).toBe("ab@test.com");
    });
  });

  describe("login flow", () => {
    it("shows validation alert when email/password is missing", () => {
      render(<LoginScreen />);

      fireEvent.press(loginButton());

      expect(Alert.alert).toHaveBeenCalledWith(
        "Lỗi",
        "Vui lòng nhập đầy đủ email và mật khẩu",
      );
    });

    it("calls supabase signInWithPassword with user input", async () => {
      const fakeEmail = faker.internet.email();
      const fakePassword = faker.internet.password();
      const fakeUserId = faker.string.uuid();

      const singleMock = jest.fn().mockResolvedValue({
        data: {
          id: fakeUserId,
          full_name: faker.person.fullName(),
          role: "MEMBER",
        },
        error: null,
      });
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as jest.Mock).mockReturnValue({ select: selectMock });
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: fakeUserId } } },
        error: null,
      });

      render(<LoginScreen />);
      fireEvent.changeText(
        screen.getByPlaceholderText("email@bv-du.com"),
        fakeEmail,
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("••••••••"),
        fakePassword,
      );
      fireEvent.press(loginButton());

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: fakeEmail,
          password: fakePassword,
        });
      });
    });

    it("stores session after successful login", async () => {
      const fakeEmail = faker.internet.email();
      const fakePassword = faker.internet.password();
      const fakeUserId = faker.string.uuid();
      const fakeSession = { user: { id: fakeUserId } };

      const singleMock = jest.fn().mockResolvedValue({
        data: {
          id: fakeUserId,
          full_name: faker.person.fullName(),
          role: "ADMIN",
        },
        error: null,
      });
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as jest.Mock).mockReturnValue({ select: selectMock });
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: fakeSession },
        error: null,
      });

      render(<LoginScreen />);
      fireEvent.changeText(
        screen.getByPlaceholderText("email@bv-du.com"),
        fakeEmail,
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("••••••••"),
        fakePassword,
      );
      fireEvent.press(loginButton());

      await waitFor(() => {
        expect(useAuthStore.getState().session).toEqual(fakeSession);
      });
    });

    it("shows success alert when login succeeds", async () => {
      const fakeEmail = faker.internet.email();
      const fakePassword = faker.internet.password();
      const fakeUserId = faker.string.uuid();

      const singleMock = jest.fn().mockResolvedValue({
        data: {
          id: fakeUserId,
          full_name: faker.person.fullName(),
          role: "MEMBER",
        },
        error: null,
      });
      const eqMock = jest.fn().mockReturnValue({ single: singleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as jest.Mock).mockReturnValue({ select: selectMock });

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: fakeUserId } } },
        error: null,
      });

      render(<LoginScreen />);
      fireEvent.changeText(
        screen.getByPlaceholderText("email@bv-du.com"),
        fakeEmail,
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("••••••••"),
        fakePassword,
      );
      fireEvent.press(loginButton());

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Thành công",
          "Đăng nhập thành công. Đang chuyển hướng...",
        );
      });
    });

    it("shows failure alert when login fails", async () => {
      const fakeEmail = faker.internet.email();
      const fakePassword = faker.internet.password();

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid login credentials" },
      });

      render(<LoginScreen />);
      fireEvent.changeText(
        screen.getByPlaceholderText("email@bv-du.com"),
        fakeEmail,
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("••••••••"),
        fakePassword,
      );
      fireEvent.press(loginButton());

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Lỗi",
          "Invalid login credentials",
        );
      });
    });

    it("calls OAuth helper with google when Google button is pressed", async () => {
      (signInWithOAuthProvider as jest.Mock).mockResolvedValue(undefined);

      render(<LoginScreen />);
      fireEvent.press(screen.getByTestId("oauth-google-login"));

      await waitFor(() => {
        expect(signInWithOAuthProvider).toHaveBeenCalledWith("google");
      });
    });

    it("calls OAuth helper with github when GitHub button is pressed", async () => {
      (signInWithOAuthProvider as jest.Mock).mockResolvedValue(undefined);

      render(<LoginScreen />);
      fireEvent.press(screen.getByTestId("oauth-github-login"));

      await waitFor(() => {
        expect(signInWithOAuthProvider).toHaveBeenCalledWith("github");
      });
    });

    it("starts Google OAuth without showing an immediate success alert", async () => {
      (signInWithOAuthProvider as jest.Mock).mockResolvedValue(undefined);

      render(<LoginScreen />);
      fireEvent.press(screen.getByTestId("oauth-google-login"));

      await waitFor(() => {
        expect(signInWithOAuthProvider).toHaveBeenCalledWith("google");
      });
    });

    it("shows failure alert when OAuth login fails", async () => {
      (signInWithOAuthProvider as jest.Mock).mockRejectedValue(
        new Error("OAuth sign-in failed"),
      );

      render(<LoginScreen />);
      fireEvent.press(screen.getByTestId("oauth-google-login"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Lỗi", "OAuth sign-in failed");
      });
    });
  });
});
