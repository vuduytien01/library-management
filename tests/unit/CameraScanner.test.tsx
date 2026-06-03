import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import CameraScanner from "../CameraScanner";
import { useCameraPermissions } from "expo-camera";

// Mock expo-camera
jest.mock("expo-camera", () => ({
  CameraView: (props: any) => {
    const React = require("react");
    const View = require("react-native").View;
    return React.createElement(
      View,
      { testID: "camera-view", ...props },
      props.children,
    );
  },
  useCameraPermissions: jest.fn(),
}));

// Mock i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("CameraScanner", () => {
  const mockOnScan = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state while permission is undetermined", () => {
    (useCameraPermissions as jest.Mock).mockReturnValue([null, jest.fn()]);
    const { toJSON } = render(
      <CameraScanner onScan={mockOnScan} onClose={mockOnClose} />,
    );
    expect(toJSON()).not.toBeNull();
  });

  it("renders grant permission button when permission is denied", async () => {
    (useCameraPermissions as jest.Mock).mockReturnValue([
      { granted: false, canAskAgain: true },
      jest.fn(),
    ]);
    const { getByText } = render(
      <CameraScanner onScan={mockOnScan} onClose={mockOnClose} />,
    );

    expect(getByText("messages.camera_permission_denied")).toBeDefined();
    expect(getByText("common.grant_permission")).toBeDefined();
  });

  it("renders camera view when permission is granted", async () => {
    (useCameraPermissions as jest.Mock).mockReturnValue([
      { granted: true },
      jest.fn(),
    ]);
    const { getByTestId, getByText } = render(
      <CameraScanner
        onScan={mockOnScan}
        onClose={mockOnClose}
        title="Scan Book"
      />,
    );

    await waitFor(() => {
      expect(getByTestId("camera-view")).toBeDefined();
      expect(getByText("Scan Book")).toBeDefined();
    });
  });
});
