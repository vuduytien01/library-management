import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLibrary } from '@/src/hooks/useLibrary';
import { useContent } from '@/src/hooks/library/useContent';

export default function LibrarianAudiobooks() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { audiobooks } = useContent();
  const { data: audiobookList, isLoading } = audiobooks.list();

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAudiobook, setEditingAudiobook] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    narrator: '',
    duration: '',
    cover_url: '',
    source: 'fonos',
    source_id: '',
    description: '',
    published_date: '',
    language: 'vi',
  });

  const resetForm = () => {
    setFormData({ 
      title: '', author: '', narrator: '', duration: '', cover_url: '',
      source: 'fonos', source_id: '', description: '', published_date: '', language: 'vi'
    });
    setEditingAudiobook(null);
  };

  const handleEdit = (audiobook: any) => {
    setEditingAudiobook(audiobook);
    setFormData({
      title: audiobook.title || '',
      author: audiobook.author || '',
      narrator: audiobook.narrator || '',
      duration: String(audiobook.duration || ''),
      cover_url: audiobook.cover_url || '',
      source: audiobook.source || 'fonos',
      source_id: audiobook.source_id || '',
      description: audiobook.description || '',
      published_date: audiobook.published_date || '',
      language: audiobook.language || 'vi',
    });
    setModalVisible(true);
  };

  const handleSave = () => {
    const payload = {
      title: formData.title,
      author: formData.author,
      narrator: formData.narrator,
      duration: parseInt(formData.duration) || 0,
      cover_url: formData.cover_url || null,
      source: formData.source || 'fonos',
      source_id: formData.source_id,
      description: formData.description || null,
      published_date: formData.published_date || null,
      language: formData.language || 'vi',
    };

    if (editingAudiobook) {
      audiobooks.update.mutate({ id: editingAudiobook.id, ...payload }, {
        onSuccess: () => {
          Alert.alert(t('common.success'), t('messages.book_updated'));
          setModalVisible(false);
          resetForm();
        },
        onError: (err: any) => {
          Alert.alert(t('common.error'), err.message);
        }
      });
    } else {
      audiobooks.add.mutate(payload, {
        onSuccess: () => {
          Alert.alert(t('common.success'), t('messages.book_added'));
          setModalVisible(false);
          resetForm();
        },
        onError: (err: any) => {
          Alert.alert(t('common.error'), err.message);
        }
      });
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert(t('librarian.delete_confirm'), t('librarian.delete_confirm_msg'), [
      { text: t('common.cancel') },
      { text: t('common.confirm'), style: 'destructive', onPress: () => {
        audiobooks.delete.mutate(item.id, {
          onSuccess: () => {
            Alert.alert(t('common.success'), t('audiobooks.delete_success'));
          },
          onError: (err: any) => {
            Alert.alert(t('common.error'), err.message);
          }
        });
      }}
    ]);
  };

  const filteredAudiobooks = audiobookList?.filter((ab: any) => 
    ab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ab.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ab.narrator?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('audiobooks.management')}</Text>
          <Text style={styles.headerSubtitle}>{t('audiobooks.subtitle_mgmt')}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => { resetForm(); setModalVisible(true); }}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#5A5F7A" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('audiobooks.search_placeholder_mgmt')}
            placeholderTextColor="#5A5F7A"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#5A5F7A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollArea}>
        {isLoading ? (
          <View style={styles.loader}>
            <Text style={styles.loaderText}>{t('messages.loading')}</Text>
          </View>
        ) : (
          filteredAudiobooks?.map((ab: any) => (
            <View key={ab.id} style={styles.card}>
              <View style={styles.cardContent}>
                {ab.cover_url ? (
                  <Image source={{ uri: ab.cover_url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover, styles.placeholder]}>
                    <Ionicons name="headset" size={24} color="#8B8FA3" />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={2}>{ab.title}</Text>
                  <Text style={styles.author} numberOfLines={1}>{ab.author || t('common.unknown')}</Text>
                  <Text style={styles.narrator} numberOfLines={1}>{t('audiobooks.voice_prefix')} {ab.narrator || t('common.unknown')}</Text>
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceText}>{ab.source?.toUpperCase() || 'N/A'}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(ab)}>
                    <Ionicons name="pencil" size={18} color="#4F8EF7" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(ab)}>
                    <Ionicons name="trash" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAudiobook ? t('audiobooks.edit_title') : t('audiobooks.add_title')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#8B8FA3" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                
                <Text style={styles.fieldLabel}>{t('common.book_title').toUpperCase()}</Text>
                <TextInput
                  value={formData.title}
                  onChangeText={(val) => setFormData({ ...formData, title: val })}
                  placeholder={t('common.book_title') + '...'}
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>{t('common.author').toUpperCase()}</Text>
                <TextInput
                  value={formData.author}
                  onChangeText={(val) => setFormData({ ...formData, author: val })}
                  placeholder={t('common.author') + '...'}
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>{t('audiobooks.narrator_label')}</Text>
                <TextInput
                  value={formData.narrator}
                  onChangeText={(val) => setFormData({ ...formData, narrator: val })}
                  placeholder={t('audiobooks.narrator_label') + '...'}
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>{t('audiobooks.duration_label')}</Text>
                <TextInput
                  value={formData.duration}
                  onChangeText={(val) => setFormData({ ...formData, duration: val })}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('audiobooks.source_label')}</Text>
                    <TextInput
                      value={formData.source}
                      onChangeText={(val) => setFormData({ ...formData, source: val })}
                      placeholder="fonos, voizfm..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>SOURCE ID</Text>
                    <TextInput
                      value={formData.source_id}
                      onChangeText={(val) => setFormData({ ...formData, source_id: val })}
                      placeholder="ID on source"
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>COVER URL</Text>
                <TextInput
                  value={formData.cover_url}
                  onChangeText={(val) => setFormData({ ...formData, cover_url: val })}
                  placeholder="https://..."
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>{t('common.description').toUpperCase()}</Text>
                <TextInput
                  value={formData.description}
                  onChangeText={(val) => setFormData({ ...formData, description: val })}
                  multiline
                  placeholder={t('common.no_description')}
                  placeholderTextColor="#3D4260"
                  style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                />

                <TouchableOpacity 
                  disabled={audiobooks.add.isPending || audiobooks.update.isPending}
                  onPress={handleSave}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitBtnText}>
                    {audiobooks.add.isPending || audiobooks.update.isPending ? t('common.loading') : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  headerSubtitle: { color: '#8B8FA3', fontSize: 14, marginTop: 4 },
  addBtn: { width: 44, height: 44, backgroundColor: '#4F8EF7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scrollArea: { paddingHorizontal: 24, paddingBottom: 40 },
  loader: { marginTop: 40, alignItems: 'center' },
  loaderText: { color: '#5A5F7A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#151929', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '92%' },
  modalIndicator: { width: 40, height: 4, backgroundColor: '#2E3654', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E2540', alignItems: 'center', justifyContent: 'center' },
  formContainer: { gap: 16, paddingBottom: 24 },
  fieldLabel: { color: '#5A5F7A', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  textInput: { backgroundColor: '#0B0F1A', borderRadius: 15, padding: 16, color: '#FFFFFF', borderWidth: 1.5, borderColor: '#1E2540', fontSize: 15 },
  row: { flexDirection: 'row', gap: 15 },
  submitBtn: { backgroundColor: '#4F8EF7', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151929',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#151929',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2540',
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  cover: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  placeholder: {
    backgroundColor: '#1E2540',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  author: {
    color: '#8A8F9E',
    fontSize: 13,
    marginBottom: 2,
  },
  narrator: {
    color: '#8A8F9E',
    fontSize: 12,
    marginBottom: 6,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A314A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceText: {
    color: '#4F8EF7',
    fontSize: 10,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
    marginLeft: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 142, 247, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
});
