import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/api/supabase';
import { booksService } from '@/src/features/books/books.service';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

export default function MetadataSources() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', url: '', is_active: true });

  const [isMounted, setIsMounted] = useState(true);
  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const { data: sources, isLoading } = useQuery({
    queryKey: ['metadata_sources'],
    queryFn: async () => {
      const { data, error } = await supabase.from('metadata_sources').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingSource) {
        const { error } = await supabase.from('metadata_sources').update(formData).eq('id', editingSource.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('metadata_sources').insert([formData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (isMounted) {
        Alert.alert(t('common.success'), t('messages.book_updated'));
        setModalVisible(false);
      }
      queryClient.invalidateQueries({ queryKey: ['metadata_sources'] });
    }
  });

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('metadata_sources').update({ is_active: !current }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['metadata_sources'] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('librarian.metadata_sources')}</Text>
        <TouchableOpacity onPress={() => {
          setEditingSource(null);
          setFormData({ name: '', url: '', is_active: true });
          setModalVisible(true);
        }} style={styles.addBtn}>
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('librarian.sync_audiobook', 'Đồng bộ Sách nói')}</Text>
        <Text style={styles.sectionSubtitle}>{t('librarian.sync_audiobook_desc', 'Cập nhật dữ liệu từ các nguồn audiobook')}</Text>
      </View>

      <View style={styles.syncContainer}>
        <SyncCard 
          name="Thư Viện Sách Nói" 
          icon="headset" 
          platform="thuviensachnoi-catalog" 
          description="Kho sách nói miễn phí lớn nhất VN"
        />
        <SyncCard 
          name="Fonos" 
          icon="musical-notes" 
          platform="fonos-catalog" 
          description="Sách nói bản quyền chất lượng cao"
        />
        <SyncCard 
          name="VoizFM" 
          icon="mic" 
          platform="voizfm-catalog" 
          description="Ứng dụng sách nói & Podcast"
        />
        <SyncCard 
          name="Làm giàu Metadata" 
          icon="sparkles" 
          platform="bulk-enrich" 
          description="Đồng bộ Tác giả/Bìa chuẩn từ Thư viện chính"
          isInternal={true}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('librarian.metadata_sources')}</Text>
        <Text style={styles.sectionSubtitle}>{t('librarian.metadata_sources_desc')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea}>
        {sources?.map((source) => (
          <View key={source.id} style={styles.sourceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sourceName}>{source.name}</Text>
              <Text style={styles.sourceUrl} numberOfLines={1}>{source.url}</Text>
            </View>
            <View style={styles.sourceActions}>
              <Switch 
                value={source.is_active} 
                onValueChange={() => toggleActive(source.id, source.is_active)}
                trackColor={{ false: '#1E2540', true: '#4F8EF7' }}
              />
              <TouchableOpacity onPress={() => {
                setEditingSource(source);
                setFormData({ name: source.name, url: source.url, is_active: source.is_active });
                setModalVisible(true);
              }} style={styles.editBtn}>
                <Ionicons name="settings-outline" size={20} color="#8B8FA3" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingSource ? t('common.edit') : t('common.add_book')}</Text>
            <TextInput
              value={formData.name}
              onChangeText={(v) => setFormData({...formData, name: v})}
              placeholder={t('librarian.source_name_placeholder', 'Tên nguồn (vd: NLV API)')}
              placeholderTextColor="#3D4260"
              style={styles.input}
            />
            <TextInput
              value={formData.url}
              onChangeText={(v) => setFormData({...formData, url: v})}
              placeholder="Base URL / API Endpoint"
              placeholderTextColor="#3D4260"
              style={styles.input}
            />
            <TouchableOpacity onPress={() => saveMutation.mutate()} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{t('common.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const SyncCard = ({ name, icon, platform, description, isInternal }: any) => {
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);

  const startSync = async () => {
    setSyncing(true);
    try {
      if (isInternal && platform === 'bulk-enrich') {
        const result = await booksService.bulkEnrichAudiobooks();
        Alert.alert(t('common.success'), t('common.sync_enrich_success', { total: result.total, updated: result.updated }));
      } else {
        // Legacy external sync simulation
        const { error } = await supabase.from('notifications').insert([{
          user_id: (await supabase.auth.getUser()).data.user?.id,
          title: t('common.sync_started'),
          body: t('common.sync_process_msg', { name }),
          type: 'info'
        }]);
        Alert.alert(t('common.success'), t('common.sync_success_msg', { name }));
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), t('common.sync_error', { error: err.message }));
    } finally {
      setTimeout(() => setSyncing(false), 1000);
    }
  };

  return (
    <View style={styles.syncCard}>
      <View style={styles.syncIconContainer}>
        <Ionicons name={icon} size={24} color="#4F8EF7" />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.syncName}>{name}</Text>
        <Text style={styles.syncDesc}>{description}</Text>
      </View>
      <TouchableOpacity 
        onPress={startSync} 
        disabled={syncing}
        style={[styles.syncBtn, syncing && { opacity: 0.5 }]}
      >
        <Text style={styles.syncBtnText}>{syncing ? '...' : t('common.sync')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  backBtn: { marginRight: 12, padding: 4 },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  sectionHeader: { paddingHorizontal: 24, marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  sectionSubtitle: { color: '#8B8FA3', fontSize: 13, marginTop: 2 },
  syncContainer: { paddingHorizontal: 24, gap: 12, marginBottom: 20 },
  syncCard: { backgroundColor: '#151929', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1E2540' },
  syncIconContainer: { width: 48, height: 48, backgroundColor: '#1E2540', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  syncName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  syncDesc: { color: '#5A5F7A', fontSize: 12, marginTop: 2 },
  syncBtn: { backgroundColor: '#4F8EF7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  syncBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  addBtn: { width: 44, height: 44, backgroundColor: '#4F8EF7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scrollArea: { paddingHorizontal: 24, paddingBottom: 40 },
  sourceCard: { backgroundColor: '#151929', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1E2540' },
  sourceName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  sourceUrl: { color: '#5A5F7A', fontSize: 12, marginTop: 4 },
  sourceActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  editBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#151929', borderRadius: 24, padding: 24, gap: 16 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  input: { backgroundColor: '#0B0F1A', borderRadius: 12, padding: 16, color: '#FFFFFF', borderWidth: 1, borderColor: '#1E2540' },
  saveBtn: { backgroundColor: '#4F8EF7', borderRadius: 12, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800' },
  cancelBtn: { alignItems: 'center', padding: 8 },
  cancelBtnText: { color: '#5A5F7A' }
});
