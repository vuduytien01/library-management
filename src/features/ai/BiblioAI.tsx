import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ai } from "../../core/ai";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/useAuthStore";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import * as Vibration from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  audioUri?: string;
  timestamp: Date;
}

export const BiblioAI: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: t(
        "ai.welcome_msg",
        "Xin chào! Tôi là BiblioAI. Tôi có thể giúp gì cho hành trình đọc sách của bạn hôm nay?",
      ),
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const profile = useAuthStore((state) => state.profile);

  const scrollViewRef = useRef<ScrollView>(null);
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, []);

  const handleSend = async (text: string, audioUri?: string) => {
    if (!text.trim() && !audioUri) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: "user",
      audioUri,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const promptText = text.trim() || "Người dùng đã gửi một tin nhắn thoại.";
      const response = await ai.askLibrarian(promptText);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("AI Chat error:", error);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      Vibration.Vibration.vibrate(50);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    pulseAnim.setValue(1);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      Vibration.Vibration.vibrate(50);

      if (uri) {
        setLoading(true);
        setTimeout(() => {
          const simulatedText = "Tìm cho tôi sách trinh thám ở London";
          setLoading(false);
          handleSend(simulatedText, uri);
        }, 1200);
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
  };

  const playVoiceMessage = async (messageId: string, uri: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        if (playingAudioId === messageId) {
          setPlayingAudioId(null);
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
      );

      setSound(newSound);
      setPlayingAudioId(messageId);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioId(null);
          setSound(null);
        }
      });
    } catch (error) {
      console.error("Failed to play sound", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sound]);

  return (
    <>
      {/* Floating Action Button */}
      <Animated.View
        style={[styles.fabContainer, { transform: [{ scale: fabAnim }] }]}
      >
        <TouchableOpacity
          onPress={() => setVisible(true)}
          style={styles.fab}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#6E45E2", "#8B5CF6"]}
            style={styles.fabGradient}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
            <View style={styles.onlineDot} />
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.fabLabelContainer}>
          <Text style={styles.fabLabel}>
            {t("ai.ask_assistant", "Hỏi Trợ lý")}
          </Text>
        </View>
      </Animated.View>

      {/* Chat Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.chatContainer}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerInfo}>
                <View style={styles.aiIcon}>
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>
                    {t("ai.assistant_title", "BiblioAI Assistant")}
                  </Text>
                  <Text style={styles.headerStatus}>
                    {t("ai.online", "Online")} •{" "}
                    {t("ai.ready_to_help", "Ready to help")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={24} color="#8A8F9E" />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.map((msg) => {
                const isPlaying = playingAudioId === msg.id;
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.sender === "user"
                        ? styles.userBubble
                        : styles.aiBubble,
                    ]}
                  >
                    {msg.audioUri && (
                      <View style={styles.audioMessageContainer}>
                        <TouchableOpacity
                          style={styles.playBtn}
                          onPress={() =>
                            playVoiceMessage(msg.id, msg.audioUri!)
                          }
                        >
                          <Ionicons
                            name={isPlaying ? "pause" : "play"}
                            size={18}
                            color="white"
                          />
                        </TouchableOpacity>
                        <View style={styles.waveformContainer}>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <View
                              key={i}
                              style={[
                                styles.waveBar,
                                { height: 4 + Math.random() * 12 },
                                isPlaying && { backgroundColor: "white" },
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                    {msg.text && (
                      <Text
                        style={[
                          styles.messageText,
                          msg.sender === "user"
                            ? styles.userText
                            : styles.aiText,
                        ]}
                      >
                        {msg.text}
                      </Text>
                    )}
                    <Text style={styles.timestamp}>
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                );
              })}
              {loading && (
                <View
                  style={[
                    styles.messageBubble,
                    styles.aiBubble,
                    styles.loadingBubble,
                  ]}
                >
                  <ActivityIndicator size="small" color="#3A75F2" />
                </View>
              )}
            </ScrollView>

            {isRecording && (
              <View style={styles.recordingOverlay}>
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={styles.recordingBlur}
                >
                  <View style={styles.recordingDotContainer}>
                    <Animated.View
                      style={[
                        styles.recordingDot,
                        { transform: [{ scale: pulseAnim }] },
                      ]}
                    />
                    <Text style={styles.recordingTimer}>
                      {formatDuration(recordingDuration)}
                    </Text>
                  </View>
                  <Text style={styles.recordingHint}>Thả để gửi</Text>
                </BlurView>
              </View>
            )}

            {/* Input Area */}
            <View style={styles.inputArea}>
              <TouchableOpacity
                style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
                onPressIn={startRecording}
                onPressOut={stopRecording}
              >
                <Ionicons
                  name={isRecording ? "mic" : "mic-outline"}
                  size={22}
                  color={isRecording ? "#EF4444" : "#8A8F9E"}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={t("ai.placeholder", "Nhập câu hỏi cho thủ thư...")}
                placeholderTextColor="#5A5F7A"
                value={input}
                onChangeText={setInput}
                multiline
              />
              <TouchableOpacity
                onPress={() => handleSend(input)}
                disabled={!input.trim() || loading}
                style={[
                  styles.sendBtn,
                  (!input.trim() || loading) && styles.sendBtnDisabled,
                ]}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    bottom: 30,
    right: 20,
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 5,
    shadowColor: "#3A75F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  chatContainer: {
    height: SCREEN_HEIGHT * 0.8,
    backgroundColor: "#0F121D",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: "#1F263B",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1F263B",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  headerStatus: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 14,
    borderRadius: 20,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#3A75F2",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#171B2B",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: "#FFFFFF",
  },
  aiText: {
    color: "#E2E8F0",
  },
  timestamp: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginTop: 6,
    alignSelf: "flex-end",
  },
  loadingBubble: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1F263B",
    backgroundColor: "#0F121D",
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#171B2B",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    color: "#FFFFFF",
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#1F263B",
    opacity: 0.5,
  },
  onlineDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  fabLabelContainer: {
    position: "absolute",
    right: 65,
    top: 15,
    backgroundColor: "#1F263B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3A75F2",
  },
  fabLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  recordingOverlay: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  recordingBlur: {
    borderRadius: 15,
    overflow: "hidden",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  recordingDotContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  recordingTimer: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  recordingHint: {
    color: "#8A8F9E",
    fontSize: 12,
  },
  audioMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  waveBar: {
    width: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 1,
  },
});
