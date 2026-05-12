import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Dimensions,
  Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeIn, 
  SlideInRight, 
  SlideInLeft, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat,
  withSequence
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAiKernel } from '../../src/services/ai/useAiKernel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  // Sử dụng Deep AI Kernel
  const { 
    mode, 
    messages, 
    visualizerData, 
    startListening, 
    stopListening, 
    sendMessage, 
    cancel 
  } = useAiKernel();

  const isListening = mode === 'listening';
  const isThinking = mode === 'thinking';
  const isSpeaking = mode === 'speaking';

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    const isAi = item.role === 'model';
    
    return (
      <Animated.View 
        entering={isAi ? SlideInLeft : SlideInRight}
        style={[styles.messageWrapper, isAi ? styles.aiWrapper : styles.userWrapper]}
      >
        {isAi && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={16} color="white" />
          </View>
        )}
        <View style={[styles.messageBubble, isAi ? styles.aiBubble : styles.userBubble]}>
          <Text style={[styles.messageText, isAi ? styles.aiText : styles.userText]}>
            {item.parts[0].text}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <LinearGradient colors={['#0B0F1A', '#171B2B']} style={styles.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>BiblioAI Assistant</Text>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, (isListening || isSpeaking) && { backgroundColor: '#3A75F2' }]} />
            <Text style={styles.statusText}>
              {mode === 'idle' ? 'Đang trực tuyến' : (isListening ? 'Đang nghe...' : (isSpeaking ? 'AI đang nói...' : 'Đang suy nghĩ...'))}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isThinking && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#3A75F2" />
          <Text style={styles.typingText}>BiblioAI đang suy nghĩ...</Text>
        </View>
      )}

      {/* Visualizer Area (Global for Chat) */}
      {(isListening || isSpeaking) && (
        <View style={styles.visualizerOverlay}>
          <BlurView intensity={30} tint="dark" style={styles.visualizerBlur}>
            <View style={styles.waveform}>
              {visualizerData.map((val, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.waveBar, 
                    { height: Math.max(4, val / 2), backgroundColor: isListening ? '#EF4444' : '#3A75F2' }
                  ]} 
                />
              ))}
            </View>
            <Text style={styles.visualizerHint}>
              {isListening ? 'Thả tay để gửi tin nhắn' : 'Chạm để ngắt lời AI'}
            </Text>
          </BlurView>
        </View>
      )}

      <View style={styles.inputContainer}>
        <BlurView intensity={20} tint="dark" style={styles.inputBlur}>
          <TouchableOpacity 
            style={[styles.voiceBtn, isListening && styles.recordingActive]} 
            onPressIn={() => {
              Vibration.vibrate(50);
              startListening();
            }}
            onPressOut={() => {
              Vibration.vibrate(50);
              stopListening();
            }}
          >
            <Ionicons name={isListening ? "mic" : "mic-outline"} size={22} color="white" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Hỏi BiblioAI về sách..."
            placeholderTextColor="#5A5F7A"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!inputText.trim() || isThinking}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </BlurView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  background: { ...StyleSheet.absoluteFillObject },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2540',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  statusText: { color: '#8B8FA3', fontSize: 11, fontWeight: '600' },
  listContent: { padding: 20, paddingBottom: 40 },
  messageWrapper: { flexDirection: 'row', marginBottom: 20, maxWidth: '85%' },
  aiWrapper: { alignSelf: 'flex-start' },
  userWrapper: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3A75F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 20,
    elevation: 2,
  },
  aiBubble: {
    backgroundColor: '#151929',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  userBubble: {
    backgroundColor: '#3A75F2',
    borderTopRightRadius: 4,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  aiText: { color: '#E2E8F0' },
  userText: { color: 'white' },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  typingText: { color: '#8B8FA3', fontSize: 12, fontStyle: 'italic' },
  visualizerOverlay: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  visualizerBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58, 117, 242, 0.3)',
  },
  waveform: {
    flexDirection: 'row',
    height: 40,
    alignItems: 'center',
    gap: 3,
    marginBottom: 8,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  visualizerHint: {
    color: '#8B8FA3',
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  inputBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 25, 41, 0.8)',
    borderRadius: 30,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1E2540',
    overflow: 'hidden',
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E2540',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingActive: {
    backgroundColor: '#EF4444',
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    paddingHorizontal: 16,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3A75F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#1E2540',
    opacity: 0.5,
  },
});
