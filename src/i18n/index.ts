import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// @ts-ignore
import vi from "./locales/vi.json";
// @ts-ignore
import en from "./locales/en.json";

const LANGUAGE_KEY = "user-language";

const languageDetector: any = {
  type: "languageDetector",
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      // 1. Check AsyncStorage
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) {
        return callback(savedLanguage);
      }

      // 2. Check Device Locale with fallback
      let deviceLanguage = "vi";
      try {
        const locales = Localization.getLocales();
        if (locales && locales.length > 0 && locales[0].languageCode) {
          deviceLanguage = locales[0].languageCode;
        }
      } catch (e) {
        console.warn("Localization detection failed, falling back to 'vi'");
      }

      return callback(
        deviceLanguage && deviceLanguage.toLowerCase().startsWith("vi")
          ? "vi"
          : "en",
      );
    } catch (error) {
      console.warn("Error detecting language:", error);
      return callback("vi");
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.warn("Error saving language:", error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    fallbackLng: "vi",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
