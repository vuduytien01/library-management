import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Modal, Alert, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLibrary } from '../../src/hooks/useLibrary';
import { BorrowRecord } from '../../src/hooks/useLibrary';
import { Ionicons } from '@expo/vector-icons';
import { payment } from '../../src/core/payment';
const { generateVietQR } = payment;
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRouter } from 'expo-router';
import { InlineUndoButton } from '../../src/components/InlineUndoButton';

export default function HistoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { borrows } = useLibrary();
  const { data: history, isLoading } = borrows.list();

  const [isMounted, setIsMounted] = useState(true);
  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const [paymentRecord, setPaymentRecord] = useState<BorrowRecord | null>(null);
  const [showQr, setShowQr] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BORROWED': return '#4F8EF7';
      case 'RETURNED': return '#10B981';
      case 'OVERDUE': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const handlePay = (record: BorrowRecord) => {
    setPaymentRecord(record);
    setShowQr(true);
  };

  const confirmPayment = () => {
    if (!paymentRecord) return;
    borrows.pay.mutate({ recordId: paymentRecord.id, method: 'VIETQR' }, {
      onSuccess: () => {
        if (!isMounted) return;
        setShowQr(false);
        Alert.alert(t('common.success'), t('messages.pay_success'));
      },
      onError: (err: any) => {
        if (isMounted) Alert.alert(t('common.error'), err.message);
      }
    });
  };

  const qrUrl = paymentRecord ? generateVietQR('970422', '0333333333', (paymentRecord as any).estimated_fine || 10000, `PAY_${paymentRecord.id.slice(0,6)}`, profile?.fullName || 'USER') : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('member.history_tab')}</Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item: record }) => (
          <View 
            style={styles.card}
            accessibilityRole="text"
            accessibilityLabel={t('messages.history_a11y', {
              title: record.book?.title,
              status: record.status,
              date: new Date(record.borrowed_at).toLocaleDateString()
            })}
          >
            <Image 
              source={{ uri: record.book?.cover_url || "https://images.unsplash.com/photo-1543005120-019f2ef5ef73?q=80&w=200" }} 
              style={styles.cover} 
              accessibilityLabel={`Bìa sách ${record.book?.title}`}
            />
            <View style={styles.info}>
              <Text style={styles.bookTitle} numberOfLines={1}>{record.book?.title}</Text>
              <Text style={styles.dateText}>
                {new Date(record.borrowed_at).toLocaleDateString()} - {record.returned_at ? new Date(record.returned_at).toLocaleDateString() : t('common.due') + ': ' + new Date(record.due_date).toLocaleDateString()}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                  {record.status}
                </Text>
              </View>
            </View>
            
            {(record as any).estimated_fine > 0 && (
              <TouchableOpacity 
                style={styles.payBtn} 
                onPress={() => handlePay(record)}
                accessibilityRole="button"
                accessibilityLabel={t('messages.pay_amount', { amount: (record as any).estimated_fine.toLocaleString() })}
                accessibilityHint="Nhấn để hiện mã QR thanh toán"
              >
                <Text style={styles.payBtnText}>{t('messages.pay_amount', { amount: (record as any).estimated_fine.toLocaleString() })}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListHeaderComponent={isLoading ? <ActivityIndicator size="large" color="#4F8EF7" style={{ marginTop: 40 }} /> : null}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <Ionicons name="time-outline" size={64} color="#1E2540" />
              <Text style={styles.emptyText}>{t('messages.no_history')}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* QR Modal */}
      <Modal visible={showQr} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('messages.pay_fine_title')}</Text>
            {qrUrl && <Image source={{ uri: qrUrl }} style={styles.qr} />}
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmPayment}>
              <Text style={styles.confirmBtnText}>{t('messages.confirm_transfer_sent')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQr(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 60, 
    paddingBottom: 24,
    gap: 16
  },
  backBtn: {
    padding: 4,
    marginRight: 4
  },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  list: { paddingHorizontal: 24, paddingBottom: 100 },
  card: { backgroundColor: '#151929', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1E2540' },
  cover: { width: 50, height: 75, borderRadius: 10 },
  info: { flex: 1, marginLeft: 16 },
  bookTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  dateText: { color: '#5A5F7A', fontSize: 11, marginTop: 4 },
  statusBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '800' },
  payBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  payBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#3D4260', marginTop: 16, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#151929', padding: 32, borderRadius: 30, alignItems: 'center', width: '85%' },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  qr: { width: 200, height: 200, borderRadius: 16, marginBottom: 20 },
  confirmBtn: { backgroundColor: '#4F8EF7', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelText: { color: '#5A5F7A', fontWeight: '600' }
});

