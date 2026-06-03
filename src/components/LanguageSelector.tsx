import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../store/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const updateLocale = useAuthStore((state) => state.updateLocale);
  const currentLang = i18n.language;

  const toggleLanguage = async () => {
    const nextLang = currentLang === "vi" ? "en" : "vi";
    await i18n.changeLanguage(nextLang);
    await AsyncStorage.setItem("user-language", nextLang);
    updateLocale(nextLang);
  };

  return (
    <TouchableOpacity
      onPress={toggleLanguage}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(79, 142, 247, 0.1)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(79, 142, 247, 0.2)",
      }}
    >
      <Text style={{ fontSize: 16, marginRight: 6 }}>
        {currentLang === "vi" ? "🇻🇳" : "🇺🇸"}
      </Text>
      <Text
        style={{
          color: "#4F8EF7",
          fontSize: 12,
          fontWeight: "bold",
          textTransform: "uppercase",
        }}
      >
        {currentLang === "vi" ? "VI" : "EN"}
      </Text>
    </TouchableOpacity>
  );
};
