import "@testing-library/jest-native/extend-expect";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const Text = require("react-native").Text;
  const Icon = ({ name }: { name?: string }) =>
    React.createElement(Text, null, name || "icon");
  return {
    Ionicons: Icon,
    MaterialCommunityIcons: Icon,
    FontAwesome: Icon,
    MaterialIcons: Icon,
    Feather: Icon,
    AntDesign: Icon,
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: any, interpolationOptions?: any) => {
      const translations: Record<string, string> = {
        "common.error": "Lỗi",
        "common.success": "Thành công",
        "common.loading": "Đang tải dữ liệu...",
      };
      let value =
        typeof options === "string"
          ? options
          : options?.defaultValue || translations[key] || key;
      const replacements =
        typeof options === "object" ? options : interpolationOptions;
      if (replacements && typeof replacements === "object") {
        Object.entries(replacements).forEach(([name, replacement]) => {
          if (name !== "defaultValue") {
            value = value.replace(`{{${name}}}`, String(replacement));
          }
        });
      }
      return value;
    },
    i18n: { language: "vi" },
  }),
}));

// Mock common native modules to prevent crashes during tests
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
    Marker: (props: any) => React.createElement(View, props),
    Polyline: (props: any) => React.createElement(View, props),
    PROVIDER_GOOGLE: "google",
  };
});

jest.mock("expo-av", () => ({
  Audio: {
    Sound: jest.fn().mockImplementation(() => ({
      loadAsync: jest.fn().mockResolvedValue(null),
      unloadAsync: jest.fn().mockResolvedValue(null),
      playAsync: jest.fn().mockResolvedValue(null),
      pauseAsync: jest.fn().mockResolvedValue(null),
      stopAsync: jest.fn().mockResolvedValue(null),
      setOnPlaybackStatusUpdate: jest.fn(),
    })),
    setIsAudioEnabledAsync: jest.fn().mockResolvedValue(null),
    setAudioModeAsync: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "test-token" }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  removeNotificationSubscription: jest.fn(),
}));

jest.mock("expo-device", () => ({
  isDevice: true,
}));

jest.mock("expo-constants", () => ({
  expoConfig: { extra: { eas: { projectId: "test-project" } } },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: "Light",
    Medium: "Medium",
    Heavy: "Heavy",
  },
  NotificationFeedbackType: {
    Success: "Success",
    Warning: "Warning",
    Error: "Error",
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn().mockResolvedValue(null),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  multiRemove: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockResolvedValue(null),
}));

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
