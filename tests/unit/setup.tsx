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

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

