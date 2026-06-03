import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ai } from "../../src/core/ai";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  SlideInRight,
  SlideInLeft,
} from "react-native-reanimated";
import {
  FALLBACK_BOOK_COVER,
  resolveBookCoverUrl,
} from "../../src/core/mediaAssets";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  suggestedBooks?: any[];
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Xin chào! Tôi là BiblioAI. Bạn cần tôi gợi ý sách hay hay giải đáp thắc mắc gì về thư viện không?",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const chatSession = useRef<any>(null);
  const profile = useAuthStore((state) => state.profile);
  const router = useRouter();

  useEffect(() => {
    // Initialize AI Session
    const initChat = async () => {
      try {
        chatSession.current = await ai.startChat();
      } catch (err) {
        console.error("Chat init error:", err);
      }
    };
    initChat();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // 1. Semantic Search for better context if query is about recommendation
      let suggestions: any[] = [];
      const lowerInput = input.toLowerCase();
      if (
        lowerInput.includes("gợi ý") ||
        lowerInput.includes("tìm") ||
        lowerInput.includes("sách")
      ) {
        suggestions = await ai.semanticSearch(input, 0.35, 3);
      }

      // 2. Send message to Gemini
      if (!chatSession.current) {
        chatSession.current = await ai.startChat();
      }

      const result = await chatSession.current.sendMessage(input);
      const aiResponseText = result.response.text();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponseText,
        sender: "ai",
        timestamp: new Date(),
        suggestedBooks: suggestions.length > 0 ? suggestions : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Rất tiếc, tôi đang gặp chút vấn đề kết nối. Bạn có thể thử lại sau giây lát không?",
          sender: "ai",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === "user";

    return (
      <View
        style={[
          styles.messageWrapper,
          isUser ? styles.userWrapper : styles.aiWrapper,
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Image
              source={{
                uri: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
              }}
              style={styles.avatarImg}
            />
          </View>
        )}
        <Animated.View
          entering={isUser ? SlideInRight : SlideInLeft}
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.aiText,
            ]}
          >
            {item.text}
          </Text>

          {item.suggestedBooks && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionTitle}>
                Sách tôi tìm thấy cho bạn:
              </Text>
              {item.suggestedBooks.map((book, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionCard}
                  onPress={() =>
                    router.push(`/(member)/book/${book.isbn}` as any)
                  }
                >
                  <Image
                    source={{
                      uri: resolveBookCoverUrl(book, FALLBACK_BOOK_COVER),
                    }}
                    style={styles.suggestedCover}
                    resizeMode="contain"
                  />
                  <View style={styles.suggestedInfo}>
                    <Text style={styles.suggestedTitle} numberOfLines={1}>
                      {book.title}
                    </Text>
                    <Text style={styles.suggestedAuthor}>{book.author}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#4F8EF7" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#0F121D", "#0B0F1A"]} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { marginRight: 8 }]}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Trò chuyện với BiblioAI</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>Đang trực tuyến</Text>
            </View>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {isLoading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color="#4F8EF7" size="small" />
            <Text style={styles.loadingText}>BiblioAI đang suy nghĩ...</Text>
          </View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Hỏi tôi bất cứ điều gì..."
              placeholderTextColor="#5A5F7A"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || isLoading) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#1F263B",
  },
  backBtn: {
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  statusText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "500",
  },
  chatList: {
    padding: 20,
    paddingBottom: 40,
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 20,
    maxWidth: "85%",
  },
  userWrapper: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  aiWrapper: {
    alignSelf: "flex-start",
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#171B2B",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  avatarImg: {
    width: 20,
    height: 20,
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: "#3A75F2",
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#171B2B",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "#FFFFFF",
  },
  aiText: {
    color: "#E0E0E0",
  },
  timestamp: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginTop: 6,
    textAlign: "right",
  },
  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  loadingText: {
    color: "#8A8F9E",
    fontSize: 12,
    marginLeft: 8,
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#171B2B",
    borderTopWidth: 1,
    borderTopColor: "#1F263B",
    paddingBottom: Platform.OS === "ios" ? 30 : 15,
  },
  input: {
    flex: 1,
    backgroundColor: "#0F121D",
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    color: "#FFFFFF",
    maxHeight: 100,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3A75F2",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  sendBtnDisabled: {
    backgroundColor: "#1F263B",
    opacity: 0.5,
  },
  suggestionsContainer: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1F263B",
  },
  suggestionTitle: {
    color: "#4F8EF7",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 10,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F121D",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1F263B",
  },
  suggestedCover: {
    width: 40,
    height: 60,
    borderRadius: 4,
  },
  suggestedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  suggestedTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  suggestedAuthor: {
    color: "#8A8F9E",
    fontSize: 12,
    marginTop: 2,
  },
});
