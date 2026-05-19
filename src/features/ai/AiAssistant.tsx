import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAiKernel } from "../../services/ai/useAiKernel";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const AiAssistant = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [input, setInput] = useState("");

  const {
    mode,
    messages,
    visualizerData,
    startListening,
    stopListening,
    sendMessage,
    cancel,
  } = useAiKernel();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const recPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    if (mode === "listening") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recPulseAnim, {
            toValue: 1.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recPulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      recPulseAnim.setValue(1);
    }
  }, [mode]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const segments = useSegments() as string[];
  const isAudiobookPage = segments.includes("audiobooks");
  const isLoading = mode === "thinking";
  const isListening = mode === "listening";
  const isSpeaking = mode === "speaking";

  return (
    <>
      <Animated.View
        style={[
          styles.fabContainer,
          isAudiobookPage && { top: 60, bottom: undefined, right: 10 },
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={styles.fabRow}>
          {!isAudiobookPage && (
            <View style={styles.fabLabelContainer}>
              <Text style={styles.fabLabel}>
                {t("ai.ask_assistant", "Hỏi Trợ lý")}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.fab,
              isAudiobookPage && { width: 40, height: 40, borderRadius: 20 },
            ]}
            onPress={() => setIsVisible(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#3A75F2", "#1E2540"]}
              style={styles.fabGradient}
            >
              <Ionicons
                name="sparkles"
                size={isAudiobookPage ? 16 : 20}
                color="#FFFFFF"
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
            <View style={styles.chatContainer}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>
                      {t("ai.assistant_title", "BiblioAI Assistant")}
                    </Text>
                    <Text style={styles.headerStatus}>
                      {mode === "idle"
                        ? t("ai.ready", "Sẵn sàng")
                        : t(`ai.mode.${mode}`, mode)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Messages */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                onContentSizeChange={() =>
                  scrollViewRef.current?.scrollToEnd({ animated: true })
                }
              >
                {messages.map((msg, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.messageRow,
                      msg.role === "user" ? styles.userRow : styles.aiRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        msg.role === "user"
                          ? styles.userBubble
                          : styles.aiBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          msg.role === "user" ? styles.userText : styles.aiText,
                        ]}
                      >
                        {msg.parts[0].text}
                      </Text>
                    </View>
                  </View>
                ))}
                {isLoading && (
                  <View style={styles.aiRow}>
                    <View
                      style={[
                        styles.messageBubble,
                        styles.aiBubble,
                        styles.loadingBubble,
                      ]}
                    >
                      <ActivityIndicator size="small" color="#3A75F2" />
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Visualizer Area */}
              {(isListening || isSpeaking) && (
                <View style={styles.visualizerContainer}>
                  <View style={styles.waveform}>
                    {visualizerData.map((val, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveBar,
                          {
                            height: Math.max(4, val / 2),
                            backgroundColor: isListening
                              ? "#EF4444"
                              : "#3A75F2",
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.visualizerText}>
                    {isListening ? "Đang nghe..." : "AI đang nói..."}
                  </Text>
                </View>
              )}

              {/* Input Area */}
              <View style={styles.inputArea}>
                <TouchableOpacity
                  style={[
                    styles.voiceBtn,
                    isListening && styles.voiceBtnActive,
                  ]}
                  onPressIn={() => {
                    Vibration.vibrate(50);
                    startListening();
                  }}
                  onPressOut={() => {
                    Vibration.vibrate(50);
                    stopListening();
                  }}
                >
                  <Ionicons
                    name={isListening ? "mic" : "mic-outline"}
                    size={22}
                    color={isListening ? "#EF4444" : "#8A8F9E"}
                  />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder={t("ai.placeholder", "Nhập câu hỏi...")}
                  placeholderTextColor="#5A5F7A"
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={handleSend}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    !input.trim() && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    bottom: 100,
    right: 20,
    zIndex: 999,
  },
  fabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fabLabelContainer: {
    backgroundColor: "rgba(31, 38, 59, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3A75F2",
  },
  fabLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    elevation: 8,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  blurContainer: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "rgba(15, 18, 29, 0.95)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aiBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerStatus: {
    color: "#10B981",
    fontSize: 12,
    textTransform: "capitalize",
  },
  closeBtn: {
    padding: 4,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 20,
    gap: 16,
  },
  messageRow: {
    maxWidth: "85%",
  },
  userRow: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  aiRow: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  messageBubble: {
    padding: 14,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: "#3A75F2",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#1E2540",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  loadingBubble: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#FFFFFF",
  },
  aiText: {
    color: "#E1E4ED",
  },
  visualizerContainer: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  waveform: {
    flexDirection: "row",
    height: 50,
    alignItems: "center",
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  visualizerText: {
    color: "#8A8F9E",
    fontSize: 12,
    marginTop: 8,
  },
  inputArea: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    gap: 12,
    backgroundColor: "#0F121D",
  },
  input: {
    flex: 1,
    backgroundColor: "#171B2B",
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#1E2540",
    opacity: 0.5,
  },
  voiceBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#171B2B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  voiceBtnActive: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
});
