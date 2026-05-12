import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLibrary, useClubChat } from '../../../src/hooks/useLibrary';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, SlideInUp, useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, withSpring } from 'react-native-reanimated';

const FloatingEmoji = ({ emoji, onComplete }: { emoji: string, onComplete: () => void }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1.5);
    translateY.value = withTiming(-150, { duration: 2000 });
    opacity.value = withSequence(
      withDelay(1000, withTiming(0, { duration: 1000 }))
    );
    
    const timeout = setTimeout(onComplete, 2100);
    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { translateX: Math.sin(translateY.value / 20) * 10 }
    ],
    opacity: opacity.value,
    position: 'absolute',
    bottom: 80,
    right: 40 + Math.random() * 40,
    zIndex: 1000,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
    </Animated.View>
  );
};

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState('');
  
  const { bookClubs } = useLibrary();
  const profile = useAuthStore(state => state.profile);
  const { data: clubs } = bookClubs.list();
  const club = clubs?.find((c: any) => c.id === id);

  const { getMessages, sendMessage, sendReaction, lastReaction, typingUsers, onlineCount, setTyping } = useClubChat(id as string);
  const { data: messages, isLoading } = getMessages();
  const [activeReactions, setActiveReactions] = useState<{ id: number, emoji: string }[]>([]);

  useEffect(() => {
    if (lastReaction) {
      setActiveReactions(prev => [...prev, { id: Date.now(), emoji: lastReaction.emoji }]);
    }
  }, [lastReaction]);

  useEffect(() => {
    if (message.length > 0) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  }, [message]);

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      await sendMessage.mutateAsync(message);
      setMessage('');
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  if (!club) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.clubName}>{club.name}</Text>
          <View style={styles.headerStatusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.memberCount}>{onlineCount} đang online • {club.member_count} thành viên</Text>
          </View>
        </View>
      </View>


      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isMe = item.user_id === profile?.id;
          return (
            <View style={[styles.messageRow, isMe && styles.myMessageRow]}>
              {!isMe && (
                <View style={styles.avatarMini}>
                  <Text style={styles.avatarText}>{item.profiles?.fullName?.charAt(0) || 'U'}</Text>
                </View>
              )}
              <View style={[styles.messageContent, isMe && styles.myMessageContent]}>
                {!isMe && <Text style={styles.senderName}>{item.profiles?.fullName}</Text>}
                <LinearGradient
                  colors={isMe ? ['#4F8EF7', '#3A75F2'] : ['#1E2540', '#171B2B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}
                >
                  <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.content}</Text>
                </LinearGradient>
                <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={isLoading ? (
          <ActivityIndicator color="#4F8EF7" size="large" style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#1E2540" />
            <Text style={styles.emptyText}>Chưa có tin nhắn nào.{"\n"}Hãy bắt đầu cuộc thảo luận!</Text>
          </View>
        )}
        ListFooterComponent={() => (
          typingUsers.length > 0 ? (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>
                {typingUsers.join(', ')} {typingUsers.length > 1 ? 'đang soạn tin...' : 'đang soạn tin...'}
              </Text>
            </View>
          ) : null
        )}
      />

      {activeReactions.map(r => (
        <FloatingEmoji 
          key={r.id} 
          emoji={r.emoji} 
          onComplete={() => setActiveReactions(prev => prev.filter(x => x.id !== r.id))} 
        />
      ))}


      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.reactionContainer}>
          {['❤️', '👏', '🔥', '😮', '😂', '💯'].map(emoji => (
            <TouchableOpacity 
              key={emoji} 
              onPress={() => sendReaction(emoji)}
              style={styles.reactionBtn}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Viết tin nhắn..."
            placeholderTextColor="#5A5F7A"
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2540',
    backgroundColor: '#171B2B',
  },
  backBtn: {
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  clubName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberCount: {
    color: '#5A5F7A',
    fontSize: 12,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  typingIndicator: {
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  typingText: {
    color: '#3A75F2',
    fontSize: 11,
    fontStyle: 'italic',
  },
  messageList: {
    padding: 20,
    paddingBottom: 40,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-end',
  },
  myMessageRow: {
    flexDirection: 'row-reverse',
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3A75F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageContent: {
    maxWidth: '80%',
  },
  myMessageContent: {
    alignItems: 'flex-end',
  },
  senderName: {
    color: '#8A8F9E',
    fontSize: 11,
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: '600',
  },
  bubble: {
    padding: 12,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  otherBubble: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  myBubble: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: '#E1E4ED',
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  messageTime: {
    color: '#5A5F7A',
    fontSize: 10,
    marginTop: 4,
    marginHorizontal: 4,
  },
  myMessageTime: {
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#5A5F7A',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#171B2B',
    borderTopWidth: 1,
    borderTopColor: '#1E2540',
  },
  input: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3A75F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    elevation: 4,
    shadowColor: '#3A75F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  reactionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(23, 27, 43, 0.8)',
    borderTopWidth: 1,
    borderTopColor: '#1E2540',
    gap: 16,
  },
  reactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2540',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D3554',
  },
  reactionEmoji: {
    fontSize: 20,
  },
});
