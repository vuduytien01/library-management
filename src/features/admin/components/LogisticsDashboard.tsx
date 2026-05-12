import { View, StyleSheet, Text, ActivityIndicator, Dimensions, FlatList, TouchableOpacity, Platform } from 'react-native';
type ImageSourcePropType = any;

import LogisticsMap from './LogisticsMap';
import { supabase } from '../../../api/supabase';


import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PROVINCES_34, StrategicRegion } from '@/src/constants/logistics';
import { LinearGradient } from 'expo-linear-gradient';

import React, { useEffect, useState } from 'react';


interface LogisticsTask {
  id: string;
  book_title: string;
  from_branch: { name: string; latitude: number; longitude: number };
  to_branch: { name: string; latitude: number; longitude: number };
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  quantity: number;
  distanceTier: 'REGIONAL' | 'NATIONAL';
}


export const LogisticsDashboard = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<LogisticsTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('inventory_transfers')
          .select('*, from_branch:from_branch_id(name, latitude, longitude, province_v2_id), to_branch:to_branch_id(name, latitude, longitude, province_v2_id)')
          .neq('status', 'COMPLETED');

        if (error) throw error;

        const processedTasks = (data || []).map(item => {
          const fromProvince = PROVINCES_34.find(p => p.id === item.from_branch.province_v2_id);
          const toProvince = PROVINCES_34.find(p => p.id === item.to_branch.province_v2_id);
          
          const isNational = fromProvince?.region !== toProvince?.region;
          
          return {
            ...item,
            distanceTier: isNational ? 'NATIONAL' : 'REGIONAL'
          } as LogisticsTask;
        });

        setTasks(processedTasks);
      } catch (err) {
        console.error('Fetch logistics error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
    
    // Subscribe to changes
    const subscription = supabase
      .channel('logistics_live')
      .on('postgres_changes' as any, { event: '*', table: 'inventory_transfers' }, () => fetchTasks())
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const renderTask = ({ item }: { item: LogisticsTask }) => {
    const isHighPriority = item.distanceTier === 'NATIONAL';
    
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskIcon}>
          <Ionicons name="cube-outline" size={20} color="#3A75F2" />
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle}>{item.book_title}</Text>
          <Text style={styles.taskRoute}>
            {item.from_branch.name} → {item.to_branch.name}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>x{item.quantity}</Text>
          </View>
          
          <View style={[
            styles.priorityBadge, 
            { backgroundColor: isHighPriority ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }
          ]}>
            <Text style={[
              styles.priorityText,
              { color: isHighPriority ? '#EF4444' : '#10B981' }
            ]}>
              {isHighPriority ? t('admin.priority_high') : t('admin.priority_standard')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#3A75F2" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('admin.logistics_title')}</Text>
          <View style={styles.liveBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <Ionicons name="options-outline" size={24} color="#5A5F7A" />
      </View>

      <View style={styles.mapWrapper}>
        <LogisticsMap 
          tasks={tasks} 
          mapStyle={darkMapStyle}
        />
      </View>

      <View style={styles.listSection}>
        <Text style={styles.listTitle}>{t('admin.active_deliveries')}</Text>
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('admin.no_logs')}</Text>
          }
        />
      </View>
    </View>
  );
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#1a1d2d" }] },
  { "featureType": "water", "stylers": [{ "color": "#0a0c14" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#5a5f7a" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 20
  },
  title: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  liveBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 6 },
  liveText: { color: '#EF4444', fontSize: 10, fontWeight: '900' },
  mapWrapper: { height: 350, width: '100%', overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject },
  markerDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFF' },
  listSection: { flex: 1, padding: 20 },
  listTitle: { color: '#8B8FA3', fontSize: 14, fontWeight: '700', marginBottom: 15 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151929',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2540'
  },
  taskIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(58, 117, 242, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  taskTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  taskRoute: { color: '#8B8FA3', fontSize: 12, marginTop: 2 },
  quantityBadge: { backgroundColor: '#3A75F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  quantityText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  emptyText: { color: '#5A5F7A', textAlign: 'center', marginTop: 40 },
  webMapFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  fallbackContent: { alignItems: 'center', maxWidth: 300 },
  fallbackTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 16 },
  fallbackSubtitle: { color: '#5A5F7A', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  flowIndicator: { flexDirection: 'row', gap: 15, marginTop: 20 },
  indicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  indicatorText: { color: '#8B8FA3', fontSize: 11, fontWeight: '600' },
  priorityBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  }
});


