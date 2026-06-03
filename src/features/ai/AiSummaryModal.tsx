import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Markdown from 'react-native-markdown-display';
import * as Speech from 'expo-speech';
import Animated, { FadeInUp, SlideInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';


const { height } = Dimensions.get('window');

interface AiSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  summary: string | null;
  loading: boolean;
  bookTitle: string;
}

export const AiSummaryModal: React.FC<AiSummaryModalProps> = ({ visible, onClose, summary, loading, bookTitle }) => {
  const { t } = useTranslation();
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const handleSpeech = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else if (summary) {
      setIsSpeaking(true);
      // Clean markdown for better speech
      const cleanText = summary.replace(/[#*`_]/g, '');
      Speech.speak(cleanText, {
        language: 'vi-VN',
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };

  React.useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        </TouchableOpacity>

        <Animated.View 
          entering={SlideInDown.springify().damping(20)}
          style={styles.container}
        >

          <View style={styles.header}>
            <View style={styles.indicator} />
            <View style={styles.titleRow}>
              <View style={styles.aiIcon}>
                <Ionicons name="sparkles" size={18} color="#4F8EF7" />
              </View>
              <Text style={styles.headerTitle}>{t("member.ai_summary", "BiblioAI Insight")}</Text>
              <TouchableOpacity 
                onPress={handleSpeech} 
                style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]}
                disabled={!summary || loading}
              >
                <Ionicons 
                  name={isSpeaking ? "stop-circle" : "volume-high"} 
                  size={20} 
                  color={isSpeaking ? "#FFFFFF" : "#4F8EF7"} 
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#8B8FA3" />
              </TouchableOpacity>
            </View>
            <Text style={styles.bookTitle} numberOfLines={1}>{bookTitle}</Text>
          </View>

          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4F8EF7" />
                <Text style={styles.loadingText}>{t("ai.analyzing_data")}</Text>
              </View>
            ) : summary ? (
              <Animated.View entering={FadeInUp.duration(400)}>
                <Markdown style={markdownStyles}>
                  {summary}
                </Markdown>
              </Animated.View>
            ) : (
              <Text style={styles.errorText}>{t("ai.summary_error")}</Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© Powered by Google Gemini 1.5 Flash</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    backgroundColor: '#151929',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: height * 0.75,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    padding: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2540',
  },
  indicator: {
    width: 40,
    height: 5,
    backgroundColor: '#30364D',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 142, 247, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  bookTitle: {
    color: '#8B8FA3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 42,
  },
  audioBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79, 142, 247, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audioBtnActive: {
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  loadingText: {
    color: '#8B8FA3',
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E2540',
    alignItems: 'center',
  },
  footerText: {
    color: '#5A5F7A',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

const markdownStyles: any = {
  body: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: { color: '#4F8EF7', marginTop: 0, marginBottom: 16 },
  heading2: { color: '#4F8EF7', marginTop: 24, marginBottom: 12 },
  bullet_list: { marginBottom: 16 },
  list_item: { color: '#8B8FA3', marginBottom: 8 },
  strong: { color: '#4F8EF7', fontWeight: 'bold' },
  paragraph: { marginBottom: 16 },
};

