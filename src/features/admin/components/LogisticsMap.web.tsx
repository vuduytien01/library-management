import React from 'react';
import { useTranslation } from 'react-i18next';

import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface LogisticsMapProps {
  tasks: any[];
  mapStyle: any;
  onMarkerPress?: (task: any) => void;
}

const LogisticsMap: React.FC<LogisticsMapProps> = () => {
  const { t } = useTranslation();

  return (
    <View style={styles.webMapFallback}>
      <LinearGradient
        colors={['#1A1D2D', '#0B0F1A']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.fallbackContent}>
        <Ionicons name="map-outline" size={64} color="#3A75F2" style={{ opacity: 0.5 }} />
        <Text style={styles.fallbackTitle}>{t('admin.web_map_title')}</Text>
        <Text style={styles.fallbackSubtitle}>
          {t('admin.web_map_subtitle')}
        </Text>
        
        <View style={styles.flowIndicator}>
          <View style={styles.indicatorRow}>
            <View style={[styles.dot, { backgroundColor: '#3A75F2' }]} />
            <Text style={styles.indicatorText}>{t('admin.source_warehouse')}</Text>
          </View>
          <View style={styles.indicatorRow}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.indicatorText}>{t('admin.destination')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  webMapFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  fallbackContent: { alignItems: 'center', maxWidth: 300 },
  fallbackTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginTop: 16 },
  fallbackSubtitle: { color: '#5A5F7A', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  flowIndicator: { flexDirection: 'row', gap: 15, marginTop: 20 },
  indicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  indicatorText: { color: '#8B8FA3', fontSize: 11, fontWeight: '600' }
});

export default LogisticsMap;
export const Marker = () => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = 'google';
