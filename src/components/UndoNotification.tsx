import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUndoStore } from "../store/useUndoStore";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const DEFAULT_DURATION = 5000;

export const UndoNotification: React.FC = () => {
  const { t } = useTranslation();
  const { currentAction, isVisible, undo, commit } = useUndoStore();
  const [progress] = useState(new Animated.Value(0));
  const slideAnim = useRef(new Animated.Value(100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible && currentAction) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Progress bar animation
      progress.setValue(0);
      const duration = currentAction.duration || DEFAULT_DURATION;

      Animated.timing(progress, {
        toValue: 1,
        duration: duration,
        useNativeDriver: false,
      }).start();

      // Set timer to commit
      timerRef.current = setTimeout(() => {
        handleCommit();
      }, duration);
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: 150,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isVisible, currentAction]);

  const handleCommit = () => {
    commit();
  };

  const handleUndo = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    undo();
  };

  if (!currentAction && !isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={["#1A1F35", "#0F121D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.content}
      >
        <View style={styles.messageRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="information-circle" size={20} color="#3A75F2" />
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {currentAction?.message}
          </Text>
          <TouchableOpacity
            onPress={handleUndo}
            style={styles.undoButton}
            activeOpacity={0.7}
          >
            <Text style={styles.undoText}>{t("common.undo", "Hoàn tác")}</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar Container */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 20,
    left: 20,
    right: 20,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  content: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(58, 117, 242, 0.2)",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconContainer: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  undoButton: {
    backgroundColor: "rgba(58, 117, 242, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  undoText: {
    color: "#4F8EF7",
    fontSize: 13,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  progressContainer: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#3A75F2",
  },
});
