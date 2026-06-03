import { faker } from "@faker-js/faker";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import SignupScreen from "../../app/(auth)/signup";
import { supabase } from "../api/supabase";
import { signInWithOAuthProvider } from "../auth/oauth";

jest.mock("../auth/oauth", () => ({
  signInWithOAuthProvider: jest.fn(),
}));

const { __routerMock } = require("expo-router");

describe("SignupScreen", () => {
  beforeEach(() => {
    __routerMock.push.mockReset();
    __routerMock.replace.mockReset();
    __routerMock.back.mockReset();

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows validation alert when required fields are missing", () => {
    render(<SignupScreen />);

    fireEvent.press(screen.getByText("Đăng ký tài khoản"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Lỗi",
      "Vui lòng nhập đầy đủ họ tên, email và mật khẩu",
    );
  });

  it("calls supabase signUp with expected payload", async () => {
    const fullName = faker.person.fullName();
    const email = faker.internet.email();
    const password = faker.internet.password({ length: 10 });

    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session: null, user: { id: faker.string.uuid() } },
      error: null,
    });

    render(<SignupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Nguyễn Văn A"), fullName);
    fireEvent.changeText(
      screen.getByPlaceholderText("email@example.com"),
      email,
    );
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), password);

    fireEvent.press(screen.getByText("Đăng ký tài khoản"));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            registration_code: "",
          },
        },
      });
    });
  });

  it("navigates to grouped login route when signup succeeds and user confirms alert", async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session: null, user: { id: faker.string.uuid() } },
      error: null,
    });

    const alertSpy = jest.spyOn(Alert, "alert");

    render(<SignupScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("Nguyễn Văn A"),
      faker.person.fullName(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("email@example.com"),
      faker.internet.email(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("••••••••"),
      faker.internet.password({ length: 10 }),
    );

    fireEvent.press(screen.getByText("Đăng ký tài khoản"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Thành công",
        "Đăng ký thành công! Hãy quay lại trang đăng nhập để tiếp tục.",
        expect.any(Array),
      );
    });

    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = lastCall?.[2] || [];
    buttons?.[0]?.onPress?.();

    expect(__routerMock.push).toHaveBeenCalledWith("/(auth)/login");
  });

  it("shows failure alert when signup fails", async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "User already registered" },
    });

    render(<SignupScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText("Nguyễn Văn A"),
      faker.person.fullName(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("email@example.com"),
      faker.internet.email(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("••••••••"),
      faker.internet.password({ length: 10 }),
    );

    fireEvent.press(screen.getByText("Đăng ký tài khoản"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Đăng ký thất bại",
        "User already registered",
      );
    });
  });

  it("navigates to grouped login route when login CTA is pressed", () => {
    render(<SignupScreen />);

    fireEvent.press(screen.getByText("Đăng nhập"));

    expect(__routerMock.push).toHaveBeenCalledWith("/(auth)/login");
  });

  describe("oauth flow", () => {
    it("calls OAuth helper with google when Google button is pressed", async () => {
      (signInWithOAuthProvider as jest.Mock).mockResolvedValue(undefined);

      render(<SignupScreen />);
      fireEvent.press(screen.getByTestId("oauth-google-signup"));

      await waitFor(() => {
        expect(signInWithOAuthProvider).toHaveBeenCalledWith("google");
      });
    });

    it("calls OAuth helper with github when GitHub button is pressed", async () => {
      (signInWithOAuthProvider as jest.Mock).mockResolvedValue(undefined);

      render(<SignupScreen />);
      fireEvent.press(screen.getByTestId("oauth-github-signup"));

      await waitFor(() => {
        expect(signInWithOAuthProvider).toHaveBeenCalledWith("github");
      });
    });

    it("shows success alert when Google OAuth signup is opened", async () => {
      (signInWithOAuthProvider as jest.Mock).mockResolvedValue(undefined);

      render(<SignupScreen />);
      fireEvent.press(screen.getByTestId("oauth-google-signup"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Thành công",
          "Đã mở đăng ký với Google. Hoàn tất xác thực để tiếp tục.",
        );
      });
    });

    it("shows failure alert when OAuth signup fails", async () => {
      (signInWithOAuthProvider as jest.Mock).mockRejectedValue(
        new Error("OAuth sign-up failed"),
      );

      render(<SignupScreen />);
      fireEvent.press(screen.getByTestId("oauth-google-signup"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Đăng ký thất bại",
          "OAuth sign-up failed",
        );
      });
    });
  });
});
