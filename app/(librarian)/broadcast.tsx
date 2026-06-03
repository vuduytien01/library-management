import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/api/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function BroadcastScreen() {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info'); // info, warning, promotion
  const [isSending, setIsSending] = useState(false);
  const user = useAuthStore((state) => state.profile);
  const router = useRouter();

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert(t('broadcast.missing_info_title'), t('broadcast.missing_info_msg'));
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.from('broadcast_messages').insert({
        title,
        content,
        type,
        sender_id: user?.id,
      });

      if (error) throw error;

      Alert.alert(t('common.success'), t('broadcast.success_msg'));
      setTitle('');
      setContent('');
      router.back();
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      Alert.alert(t('common.error'), error.message || t('common.error'));
    } finally {
      setIsSending(false);
    }
  };

  const types = [
    { id: 'info', label: t('broadcast.info'), icon: 'information-circle', color: '#3A75F2' },
    { id: 'warning', label: t('broadcast.warning'), icon: 'warning', color: '#F59E0B' },
    { id: 'promotion', label: t('broadcast.promotion'), icon: 'gift', color: '#10B981' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('broadcast.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('broadcast.type_label')}</Text>
          <View style={styles.typeContainer}>
            {types.map((tItem) => (
              <TouchableOpacity
                key={tItem.id}
                style={[
                  styles.typeBtn,
                  type === tItem.id && { backgroundColor: tItem.color, borderColor: tItem.color }
                ]}
                onPress={() => setType(tItem.id)}
              >
                <Ionicons name={tItem.icon as any} size={18} color={type === tItem.id ? '#FFFFFF' : tItem.color} />
                <Text style={[styles.typeLabel, type === tItem.id && { color: '#FFFFFF' }]}>{tItem.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('broadcast.subject')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('broadcast.subject_placeholder')}
            placeholderTextColor="#5A5F7A"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>{t('broadcast.content')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('broadcast.content_placeholder')}
            placeholderTextColor="#5A5F7A"
            multiline
            numberOfLines={6}
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
          />

          <TouchableOpacity 
            style={[styles.sendBtn, isSending && styles.disabledBtn]} 
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.sendBtnText}>{t('broadcast.send_now')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="bulb-outline" size={20} color="#3A75F2" />
          <Text style={styles.infoText}>
            {t('broadcast.realtime_hint')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F121D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F263B',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scroll: {
    padding: 20,
  },
  card: {
    backgroundColor: '#171B2B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F263B',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8F9E',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#0F121D',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1F263B',
  },
  textArea: {
    height: 120,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F263B',
    gap: 6,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  sendBtn: {
    backgroundColor: '#3A75F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(58, 117, 242, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    color: '#8A8F9E',
    fontSize: 13,
    lineHeight: 18,
  },
});
