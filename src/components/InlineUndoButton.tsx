import React from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useUndoStore } from "../store/useUndoStore";
import { haptics } from "../core/haptics";
import Animated, { FadeInRight, FadeOutRight } from "react-native-reanimated";

export const InlineUndoButton = () => {
  const { t } = useTranslation();
  const currentAction = useUndoStore((state) => state.currentAction);
  const undo = useUndoStore((state) => state.undo);

  if (!currentAction) return null;

  return (
    <Animated.View 
      entering={FadeInRight} 
      exiting={FadeOutRight}
      style={styles.container}
    >
      <TouchableOpacity
        onPress={() => {
          haptics.notification("success");
          undo();
        }}
        style={styles.button}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-undo-outline" size={16} color="#FFFFFF" />
        <Text style={styles.text}>{t("common.undo")}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
