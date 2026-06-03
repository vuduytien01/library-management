import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDark: () => boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark', // Default to BiblioTech Navy Dark
      setTheme: (theme) => set({ theme }),
      isDark: () => {
        const { theme } = get();
        if (theme === 'system') {
          // Fallback, should ideally use useColorScheme from react-native
          return true; // Assume dark for system fallback in BiblioTech
        }
        return theme === 'dark';
      },
    }),
    {
      name: 'bibliotech-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
