import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { notificationService } from '../../src/core/notifications';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';

export default function NotificationsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const profile = useAuthStore((state) => state.profile);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    if (!profile?.id) return;
    const data = await notificationService.getNotifications(profile.id);
    setNotifications(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [profile?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAsRead = async (id: string) => {
    const success = await notificationService.markAsRead(id);
    if (success) {
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  const handleMarkAllRead = async () => {
    if (!profile?.id) return;
    const success = await notificationService.markAllAsRead(profile.id);
    if (success) {
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'DUE_DATE': return 'time';
      case 'NEW_ARRIVAL': return 'book';
      case 'CLUB_MENTION': return 'people';
      case 'SYSTEM': return 'notifications';
      default: return 'mail';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'DUE_DATE': return '#EF4444';
      case 'NEW_ARRIVAL': return '#10B981';
      case 'CLUB_MENTION': return '#F59E0B';
      case 'SYSTEM': return '#3A75F2';
      default: return '#8B8FA3';
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      onPress={() => handleMarkAsRead(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: getColor(item.type) + '15' }]}>
        <Ionicons name={getIcon(item.type) as any} size={22} color={getColor(item.type)} />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, !item.is_read && styles.unreadText]}>{item.title}</Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.timeText}>
          {format(new Date(item.created_at), 'HH:mm, dd MMMM yyyy', { locale: i18n.language === 'vi' ? vi : enUS })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.notifications')}</Text>
        {notifications.some(n => !n.is_read) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>{t('common.mark_all_read')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3A75F2" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3A75F2" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={64} color="#1E2540" />
              </View>
              <Text style={styles.emptyTitle}>{t('member.notifications.empty')}</Text>
              <Text style={styles.emptyDesc}>{t('messages.no_notifications_desc', 'Stay tuned for updates!')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2540',
    justifyContent: 'space-between'
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  markAllText: { color: '#3A75F2', fontSize: 13, fontWeight: '700' },
  list: { padding: 20 },
  notificationCard: { 
    flexDirection: 'row', 
    backgroundColor: '#151929', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2540'
  },
  unreadCard: {
    borderColor: 'rgba(58, 117, 242, 0.3)',
    backgroundColor: 'rgba(58, 117, 242, 0.05)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  contentContainer: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  unreadText: { fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3A75F2' },
  cardBody: { color: '#8B8FA3', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  timeText: { color: '#5A5F7A', fontSize: 11 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconCircle: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: '#151929', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E2540'
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyDesc: { color: '#5A5F7A', fontSize: 14, textAlign: 'center', lineHeight: 20 }
});
