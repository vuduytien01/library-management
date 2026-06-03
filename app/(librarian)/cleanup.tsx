import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/api/supabase';
import { BookItem } from '@/src/features/books/components/BookItem';
import { Book } from '@/src/hooks/library/types';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

export default function BookCleanup() {
  const { t } = useTranslation();
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  const fetchDuplicates = async (isMounted: boolean = true) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_duplicate_books');
      if (error) throw error;
      if (isMounted) setDuplicates(data || []);
    } catch (err: any) {
      if (isMounted) Alert.alert(t('common.error'), err.message);
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchDuplicates(isMounted);
    return () => { isMounted = false; };
  }, []);

  const handleMerge = async (title: string, author: string, keepIsbn: string, deleteIsbns: string[]) => {
    setMerging(true);
    try {
      for (const delIsbn of deleteIsbns) {
        const { error } = await supabase.rpc('merge_books', { 
          keep_isbn: keepIsbn, 
          delete_isbn: delIsbn 
        });
        if (error) throw error;
      }
      Alert.alert(t('common.success'), t('cleanup.merge_success_msg', { title }));
      fetchDuplicates();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setMerging(false);
    }
  };

  const autoMergeAll = async () => {
    Alert.alert(
      t('cleanup.auto_merge_confirm_title'), 
      t('cleanup.auto_merge_confirm_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.confirm'), 
          onPress: async () => {
            setMerging(true);
            try {
              for (const group of duplicates) {
                const books = group.book_details;
                // Sort by "quality": has rating > has description > has cover
                const sorted = [...books].sort((a, b) => {
                  let scoreA = 0;
                  let scoreB = 0;
                  if (a.average_rating) scoreA += 10;
                  if (a.description) scoreA += 5;
                  if (a.cover_url) scoreA += 2;
                  if (b.average_rating) scoreB += 10;
                  if (b.description) scoreB += 5;
                  if (b.cover_url) scoreB += 2;
                  return scoreB - scoreA;
                });

                const keep = sorted[0];
                const others = sorted.slice(1).map(b => b.isbn);
                
                for (const delIsbn of others) {
                  await supabase.rpc('merge_books', { keep_isbn: keep.isbn, delete_isbn: delIsbn });
                }
              }
              Alert.alert(t('common.success'), t('cleanup.cleanup_complete'));
              fetchDuplicates();
            } catch (err: any) {
              Alert.alert(t('common.error'), err.message);
            } finally {
              setMerging(false);
            }
          }
        }
      ]
    );
  };

  const handleSystemCleanup = async () => {
    Alert.alert(
      t('cleanup.system_optimize_title'), 
      t('cleanup.system_optimize_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.confirm'), 
          onPress: async () => {
            setMerging(true);
            try {
              const { data, error } = await supabase.rpc('fn_cleanup_system_resources');
              if (error) throw error;
              
              const deleted = data.notifications_deleted || 0;
              Alert.alert(t('common.success'), t('cleanup.optimize_success_msg', { count: deleted }));
            } catch (err: any) {
              Alert.alert(t('common.error'), err.message);
            } finally {
              setMerging(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('cleanup.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={handleSystemCleanup} style={[styles.autoBtn, { backgroundColor: '#10B981' }]}>
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.autoBtnText}>{t('cleanup.optimize_db')}</Text>
          </TouchableOpacity>
          {duplicates.length > 0 && !merging && (
            <TouchableOpacity onPress={autoMergeAll} style={styles.autoBtn}>
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text style={styles.autoBtnText}>{t('cleanup.merge_dupes')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4F8EF7" style={{ marginTop: 50 }} />
      ) : duplicates.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={80} color="#1E2540" />
          <Text style={styles.emptyText}>{t('cleanup.no_dupes')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.countText}>{t('cleanup.groups_found', { count: duplicates.length })}</Text>
          
          {duplicates.map((group, idx) => (
            <View key={idx} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle} numberOfLines={1}>{group.title}</Text>
                <Text style={styles.groupAuthor}>{group.author}</Text>
              </View>
              
              {group.book_details.map((book: any) => (
                <View key={book.isbn} style={styles.bookRow}>
                  <BookItem item={book as Book} />
                  <View style={styles.isbnTag}>
                    <Text style={styles.isbnText}>ISBN: {book.isbn}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity 
                style={styles.mergeBtn}
                onPress={() => {
                  const sorted = [...group.book_details].sort((a, b) => {
                    let scoreA = (a.average_rating ? 10 : 0) + (a.description ? 5 : 0);
                    let scoreB = (b.average_rating ? 10 : 0) + (b.description ? 5 : 0);
                    return scoreB - scoreA;
                  });
                  handleMerge(group.title, group.author, sorted[0].isbn, sorted.slice(1).map(b => b.isbn));
                }}
              >
                <Text style={styles.mergeBtnText}>{t('cleanup.merge_this_group')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {merging && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.overlayText}>{t('cleanup.merging')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  backBtn: { padding: 4 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20 
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  autoBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#3A75F2', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10 
  },
  autoBtnText: { color: '#FFFFFF', fontWeight: 'bold', marginLeft: 6, fontSize: 13 },
  list: { padding: 20 },
  countText: { color: '#5A5F7A', marginBottom: 20, fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#5A5F7A', marginTop: 16, fontSize: 16, fontWeight: '600' },
  groupCard: { 
    backgroundColor: '#151929', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: '#1E2540' 
  },
  groupHeader: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1E2540', paddingBottom: 12 },
  groupTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  groupAuthor: { color: '#8B8FA3', fontSize: 14, marginTop: 2 },
  bookRow: { marginBottom: 12 },
  isbnTag: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    backgroundColor: '#1E2540', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  isbnText: { color: '#5A5F7A', fontSize: 9, fontWeight: '700' },
  mergeBtn: { 
    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
    padding: 12, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  mergeBtnText: { color: '#10B981', fontWeight: 'bold', fontSize: 14 },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 100
  },
  overlayText: { color: '#FFFFFF', marginTop: 16, fontWeight: 'bold' }
});
