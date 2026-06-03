import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
    ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useHumanLibraryPerson } from "./human-library.data";

export default function HumanLibraryDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId || "";
  const { t } = useTranslation();
  const { person, isLoading } = useHumanLibraryPerson(id);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {t("human_library.detail_title", { id: id || "unknown" })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#3A75F2" />
            <Text style={styles.loadingText}>{t("human_library.loading")}</Text>
          </View>
        ) : null}

        {!isLoading && !person ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {t("human_library.not_found")}
            </Text>
          </View>
        ) : null}

        {person ? (
          <View style={styles.card}>
            <Text style={styles.personName}>{person.name}</Text>
            <Text style={styles.personMeta}>
              {person.role === "ADMIN"
                ? t("human_library.role_admin")
                : t("human_library.role_librarian")}
              {" · "}
              {person.expertise}
            </Text>
            <Text style={styles.p}>{person.story}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  header: { flexDirection: "row", alignItems: "center", padding: 16 },
  backBtn: { padding: 8, marginRight: 8 },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  content: { padding: 16 },
  p: { color: "#8A8F9E" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  loadingText: { color: "#C9CED9" },
  emptyState: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#121421",
    marginBottom: 12,
  },
  emptyTitle: { color: "#FFFFFF", fontWeight: "700" },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#121421",
  },
  personName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  personMeta: { color: "#8A8F9E", marginBottom: 12 },
});
