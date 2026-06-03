import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

export const DeferredBiblioAI: React.FC = () => {
  const { t } = useTranslation();
  const [Assistant, setAssistant] =
    React.useState<React.ComponentType<{ initialVisible?: boolean }> | null>(
      null,
    );
  const [loading, setLoading] = React.useState(false);

  const openAssistant = () => {
    if (Assistant || loading) return;
    setLoading(true);
    import("./BiblioAI")
      .then((module) => {
        setAssistant(() => module.BiblioAI);
      })
      .catch((error) => {
        console.warn("[BiblioAI] Failed to load assistant:", error);
      })
      .finally(() => setLoading(false));
  };

  if (Assistant) return <Assistant initialVisible />;

  return (
    <View style={styles.fabContainer}>
      <TouchableOpacity
        onPress={openAssistant}
        style={styles.fab}
        activeOpacity={0.85}
        disabled={loading}
      >
        <LinearGradient
          colors={["#6E45E2", "#8B5CF6"]}
          style={styles.fabGradient}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
          )}
          <View style={styles.onlineDot} />
        </LinearGradient>
      </TouchableOpacity>
      <View style={styles.fabLabelContainer}>
        <Text style={styles.fabLabel}>
          {t("ai.ask_assistant", "Hỏi Trợ lý")}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    right: 20,
    bottom: 100,
    alignItems: "center",
    zIndex: 1000,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: "#6E45E2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  fabLabelContainer: {
    marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fabLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
});
