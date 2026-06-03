import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUndoStore } from "../store/useUndoStore";
import { useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInRight, FadeOutRight } from "react-native-reanimated";

export const GlobalUndoButton = () => {
  const { t } = useTranslation();
  const currentAction = useUndoStore((state) => state.currentAction);
  const isVisible = useUndoStore((state) => state.isVisible);
  const undo = useUndoStore((state) => state.undo);
  const segments = useSegments();
  const segs = segments as string[];

  // Hide only on top-level dashboard pages — NOT on sub-pages like book/[isbn]
  const lastSegment = segs[segs.length - 1];
  const isDashboard = 
    segs.length === 0 || 
    (segs.length <= 2 && lastSegment === "index") ||
    lastSegment === "logistics" ||
    (segs.length === 3 && segs[1] === "audiobooks" && segs[2] === "index") ||
    (segs.length === 2 && segs[0] === "(admin)" && segs[1] === "");

  if (!currentAction || !isVisible || isDashboard) return null;

  return (
    <Animated.View 
      entering={FadeInRight} 
      exiting={FadeOutRight}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={() => undo()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-undo" size={18} color="#FFFFFF" />
        <Text style={styles.text}>{t("common.undo")}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    zIndex: 10000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A75F2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
