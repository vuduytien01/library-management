import '@testing-library/jest-native/extend-expect';

// Mock common native modules to prevent crashes during tests
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
    Marker: (props: any) => React.createElement(View, props),
    Polyline: (props: any) => React.createElement(View, props),
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('expo-av', () => ({
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

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(null),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockResolvedValue(null),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

