import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAnnotations } from '../../../hooks/library/useMember';
import { Annotation } from '../members.types';
import { useUndoStore } from '../../../store/useUndoStore';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

interface AnnotationLayerProps {
  isVisible: boolean;
  onClose: () => void;
  bookIsbn: string;
  bookTitle: string;
}

const COLORS = ['#FFEB3B', '#FFCDD2', '#C8E6C9', '#BBDEFB', '#E1BEE7'];

export default function AnnotationLayer({ isVisible, onClose, bookIsbn, bookTitle }: AnnotationLayerProps) {
  const { t } = useTranslation();
  const { annotations, isLoading: loading, addAnnotation, removeAnnotation: deleteAnnotation, setAnnotations } = useAnnotations(bookIsbn);

  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isPublic, setIsPublic] = useState(false);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    await addAnnotation(newNote, undefined, { page: 1 }, selectedColor, isPublic);

    setNewNote('');
    setIsAdding(false);
  };

  const renderAnnotation = (item: Annotation) => (
    <View key={item.id} style={[styles.card, { borderLeftColor: item.color }]}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.user?.fullName || 'Độc giả'}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
        </View>
        <TouchableOpacity onPress={() => {
          const snapshot = [...annotations];
          setAnnotations(annotations.filter((a: Annotation) => a.id !== item.id));

          useUndoStore.getState().queueAction({
            message: t('admin.delete_annotation_pending'),
            onUndo: () => {
              setAnnotations(snapshot);
            },
            onCommit: async () => {
              try {
                await deleteAnnotation(item.id);
              } catch (err) {
                setAnnotations(snapshot);
                throw err;
              }
            }
          });
        }}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      {item.is_public && (
        <View style={styles.publicBadge}>
          <Ionicons name="people" size={12} color="#3A75F2" />
          <Text style={styles.publicText}>Công khai</Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Ghi chú & Cảm nghĩ</Text>
              <Text style={styles.headerSubtitle}>{bookTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#3A75F2" style={{ marginTop: 50 }} />
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {annotations.length === 0 && !isAdding ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="create-outline" size={64} color="#1E2540" />
                  <Text style={styles.emptyText}>Chưa có ghi chú nào. Hãy là người đầu tiên!</Text>
                </View>
              ) : (
                annotations.map(renderAnnotation)
              )}
            </ScrollView>
          )}

          {isAdding ? (
            <View style={styles.inputArea}>
              <View style={styles.colorPicker}>
                {COLORS.map(c => (
                  <TouchableOpacity 
                    key={c} 
                    style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorSelected]}
                    onPress={() => setSelectedColor(c)}
                  />
                ))}
                <View style={{ flex: 1 }} />
                <TouchableOpacity 
                  style={styles.publicToggle}
                  onPress={() => setIsPublic(!isPublic)}
                >
                  <Ionicons name={isPublic ? "eye" : "eye-off"} size={20} color={isPublic ? "#3A75F2" : "#5A5F7A"} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Viết cảm nghĩ của bạn..."
                placeholderTextColor="#5A5F7A"
                multiline
                value={newNote}
                onChangeText={setNewNote}
                autoFocus
              />
              <View style={styles.inputActions}>
                <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdd}>
                  <LinearGradient
                    colors={['#3A75F2', '#6366F1']}
                    style={styles.submitBtn}
                  >
                    <Text style={styles.submitText}>Lưu ghi chú</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.fab}
              onPress={() => setIsAdding(true)}
            >
              <LinearGradient
                colors={['#3A75F2', '#6366F1']}
                style={styles.fabGradient}
              >
                <Ionicons name="add" size={32} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  contentContainer: { 
    height: '80%', 
    backgroundColor: '#0B0F1A', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: '#1E2540'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2540',
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#5A5F7A', fontSize: 14, marginTop: 4 },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 100 },
  card: {
    backgroundColor: '#171B2B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  userInfo: { flex: 1 },
  userName: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  time: { color: '#5A5F7A', fontSize: 11, marginTop: 2 },
  content: { color: '#D1D5DB', fontSize: 15, lineHeight: 22 },
  publicBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  publicText: { color: '#3A75F2', fontSize: 11, marginLeft: 4, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#5A5F7A', fontSize: 15, textAlign: 'center', marginTop: 16 },
  fab: { position: 'absolute', bottom: 30, right: 30 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  inputArea: {
    padding: 24,
    backgroundColor: '#171B2B',
    borderTopWidth: 1,
    borderTopColor: '#1E2540',
  },
  colorPicker: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  colorDot: { width: 24, height: 24, borderRadius: 12, marginRight: 12 },
  colorSelected: { borderWidth: 2, borderColor: 'white' },
  publicToggle: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10 },
  input: {
    color: 'white',
    fontSize: 16,
    backgroundColor: '#0B0F1A',
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  inputActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, alignItems: 'center' },
  cancelBtn: { marginRight: 24 },
  cancelText: { color: '#5A5F7A', fontSize: 15, fontWeight: '600' },
  submitBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  submitText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
});
