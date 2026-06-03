import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import type { HumanLibraryPerson } from "./human-library.data";
import { useHumanLibraryPeople } from "./human-library.data";

export default function HumanLibraryProposals() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: people = [], isLoading } = useHumanLibraryPeople();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{t("human_library.proposals_title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.p}>{t("human_library.proposals_intro")}</Text>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#3A75F2" />
            <Text style={styles.loadingText}>{t("human_library.loading")}</Text>
          </View>
        ) : null}

        {!isLoading && people.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {t("human_library.no_proposals")}
            </Text>
          </View>
        ) : null}

        {people.map((person: HumanLibraryPerson) => (
          <TouchableOpacity
            key={person.id}
            style={styles.card}
            onPress={() =>
              router.push(`/(member)/human-library/${person.id}` as any)
            }
          >
            <Text style={styles.cardTitle}>
              {t("human_library.meet_prefix", { name: person.name })}
            </Text>
            <Text style={styles.cardSubtitle}>
              {person.role === "ADMIN"
                ? t("human_library.role_admin")
                : t("human_library.role_librarian")}
              {" · "}
              {person.expertise}
            </Text>
          </TouchableOpacity>
        ))}
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
    marginTop: 12,
    marginBottom: 12,
  },
  loadingText: { color: "#C9CED9" },
  emptyState: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#121421",
    marginTop: 12,
  },
  emptyTitle: { color: "#FFFFFF", fontWeight: "700" },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#121421",
    marginTop: 12,
  },
  cardTitle: { color: "#FFFFFF", fontWeight: "700", marginBottom: 4 },
  cardSubtitle: { color: "#8A8F9E", fontSize: 12 },
});
