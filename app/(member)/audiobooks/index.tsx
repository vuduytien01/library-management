import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLibrary, useInteractions } from '../../../src/hooks/useLibrary';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { supabase } from '../../../src/api/supabase';
import { useAuthStore } from '../../../src/store/useAuthStore';

const { width } = Dimensions.get('window');

export default function AudiobookCatalog() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { audiobooks } = useLibrary();
  const { data: books, isLoading } = audiobooks.list();
  const [searchQuery, setSearchQuery] = useState('');
  const { profile } = useAuthStore();
  const { data: interactions = [], refetch: refetchInteractions } = useInteractions(profile?.id, 'AUDIOBOOK');
  const [activeTab, setActiveTab] = useState<'ALL' | 'SAVED' | 'LIKED'>('ALL');

  useFocusEffect(
    useCallback(() => {
      refetchInteractions();
    }, [refetchInteractions])
  );

  const filteredBooks = books?.filter((b: any) => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.author?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'SAVED') {
       return interactions.some(i => String(i.item_id) === String(b.id) && i.interaction_type === 'BOOKMARK');
    }
    if (activeTab === 'LIKED') {
       return interactions.some(i => String(i.item_id) === String(b.id) && i.interaction_type === 'LIKE');
    }
    return true;
  });

  const getLocalizedDuration = (dur?: string) => {
    if (!dur || dur === '0 phút' || dur === '0 minutes') return t("audiobook.updating", "Updating...");
    
    // Replace Vietnamese units with translated ones if needed
    // The duration string from booksService currently defaults to Vietnamese units
    return dur
      .replace(/giờ/g, t("audiobook.hours", "giờ"))
      .replace(/phút/g, t("audiobook.minutes", "phút"))
      .replace(/giây/g, t("audiobook.seconds", "giây"));
  };

  const getLocalizedTitle = (book: any) => {
    let title = i18n.language === 'en' ? (book.title_en || book.title) : (book.title_vi || book.title);
    
    // Add language suffix if system is English and book is in Vietnamese
    if (i18n.language === 'en' && book.language === 'vi') {
      title += ` (${t("audiobook.audio_vietnamese", "Audio Vietnamese")})`;
    }
    
    return title;
  };

  const getLocalizedAuthor = (book: any) => {
    if (i18n.language === 'en') {
      return book.author_en || book.canonical_author || book.author;
    }
    return book.author_vi || book.canonical_author || book.author;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t("audiobook.title", "Audiobooks")}</Text>
          <Text style={styles.subtitle}>{t("audiobook.subtitle", "Nghe sách mọi lúc, mọi nơi")}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#5A5F7A" style={{ marginLeft: 16 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("audiobook.search_placeholder", "Tìm sách nói...")}
          placeholderTextColor="#5A5F7A"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterTabs}>
        <TouchableOpacity 
          style={[styles.filterTab, activeTab === 'ALL' && styles.activeTab]} 
          onPress={() => setActiveTab('ALL')}
        >
          <Text style={[styles.filterText, activeTab === 'ALL' && styles.activeText]}>{t("audiobook.filter_all", "All")}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeTab === 'SAVED' && styles.activeTab]} 
          onPress={() => setActiveTab('SAVED')}
        >
          <Text style={[styles.filterText, activeTab === 'SAVED' && styles.activeText]}>{t("audiobook.filter_saved", "Saved")}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, activeTab === 'LIKED' && styles.activeTab]} 
          onPress={() => setActiveTab('LIKED')}
        >
          <Text style={[styles.filterText, activeTab === 'LIKED' && styles.activeText]}>{t("audiobook.filter_liked", "Liked")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3A75F2" style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.grid}>
            {filteredBooks?.map((book: any, index: number) => (
              <Animated.View 
                key={book.id} 
                entering={FadeInDown.delay(index * 50).duration(500)}
                style={styles.cardWrapper}
              >
                <TouchableOpacity 
                  style={styles.card}
                  onPress={() => router.push(`/(member)/audiobooks/${book.id}` as any)}
                >
                  <Image 
                    source={(book.canonical_cover_url || book.cover_url) ? { uri: book.canonical_cover_url || book.cover_url } : undefined} 
                    style={styles.cover} 
                  />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.overlay}>
                    <View style={styles.playIcon}>
                      <Ionicons name="play" size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.bookTitle} numberOfLines={2}>{getLocalizedTitle(book)}</Text>
                      <Text style={styles.author} numberOfLines={1}>{getLocalizedAuthor(book)}</Text>
                      <View style={styles.durationRow}>
                        <Ionicons name="time-outline" size={12} color="#8A8F9E" />
                        <Text style={styles.durationText}>{getLocalizedDuration(book.duration)}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#171B2B', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8A8F9E', fontSize: 13, marginTop: 2 },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#151929', 
    marginHorizontal: 24, 
    borderRadius: 16, 
    height: 52, 
    borderWidth: 1, 
    borderColor: '#1E2540',
    marginBottom: 20
  },
  searchInput: { flex: 1, marginLeft: 12, color: '#FFFFFF', fontSize: 16 },
  filterTabs: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 10 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#151929', borderWidth: 1, borderColor: '#1E2540' },
  activeTab: { backgroundColor: '#3A75F2', borderColor: '#3A75F2' },
  filterText: { color: '#8A8F9E', fontSize: 13, fontWeight: '600' },
  activeText: { color: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardWrapper: { width: '48%', marginBottom: 16 },
  card: { height: 260, borderRadius: 20, overflow: 'hidden', backgroundColor: '#171B2B' },
  cover: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', padding: 12, justifyContent: 'flex-end' },
  playIcon: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#3A75F2', 
    alignItems: 'center', 
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#3A75F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  info: {},
  bookTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  author: { color: '#8A8F9E', fontSize: 11, marginTop: 2 },
  durationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  durationText: { color: '#8A8F9E', fontSize: 10, fontWeight: '600' }
});
