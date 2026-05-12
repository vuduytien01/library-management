/** @type {import('jest').Config} */
const config = {
  rootDir: '.',

  preset: 'react-native',


  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.tsx'],
  automock: false,
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/unit/setup.tsx',
    '<rootDir>/tests/unit/setup.ts',
  ],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}', '<rootDir>/tests/**/*.spec.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|react-native-paper|expo|@expo|nativewind|react-native-reanimated|@tanstack|zustand|react-native-url-polyfill|react-native-web|@faker-js)',
  ],
  moduleNameMapper: {
    // Priority 1: Direct mocks
    '^@/src/api/supabase$': '<rootDir>/tests/__mocks__/api/supabase.js',
    '^@/src/constants/logistics$': '<rootDir>/src/constants/logistics.ts',
    
    // Priority 2: General Aliases
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
    
    // Priority 3: Relative legacy paths (from existing tests)
    '^../api/supabase$': '<rootDir>/tests/__mocks__/api/supabase.js',
    '^../../src/api/supabase$': '<rootDir>/tests/__mocks__/api/supabase.js',
    '^../../api/supabase$': '<rootDir>/tests/__mocks__/api/supabase.js',
  },




  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.test.{ts,tsx}',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};

module.exports = config;
