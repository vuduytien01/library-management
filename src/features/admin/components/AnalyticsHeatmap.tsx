import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

interface HeatmapData {
  day: string;
  count: number;
}

interface AnalyticsHeatmapProps {
  data: HeatmapData[];
}

const { width } = Dimensions.get('window');
const BOX_SIZE = (width - 60) / 7;

export const AnalyticsHeatmap: React.FC<AnalyticsHeatmapProps> = ({ data }) => {
  const { t, i18n } = useTranslation();
  const DAYS = i18n.language === 'en' 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // Simple logic to map data to a 7x8 grid (last 8 weeks)
  const renderBox = (count: number) => {
    let opacity = 0.05;
    if (count > 0) opacity = 0.2;
    if (count > 5) opacity = 0.4;
    if (count > 10) opacity = 0.7;
    if (count > 20) opacity = 1;

    return (
      <View 
        style={[
          styles.box, 
          { backgroundColor: `rgba(58, 117, 242, ${opacity})` }
        ]} 
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.daysLabels}>
        {DAYS.map(day => (
          <Text key={day} style={styles.label}>{day}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {/* Placeholder logic for 56 days (8 weeks) */}
        {Array.from({ length: 56 }).map((_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (55 - i));
          const dateStr = date.toISOString().split('T')[0];
          const entry = data.find(d => d.day === dateStr);
          return (
            <View key={i} style={styles.boxWrapper}>
              {renderBox(entry?.count || 0)}
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>{t('analytics.less', 'Ít')}</Text>
        {[0.05, 0.2, 0.4, 0.7, 1].map((op, i) => (
          <View key={i} style={[styles.legendBox, { backgroundColor: `rgba(58, 117, 242, ${op})` }]} />
        ))}
        <Text style={styles.legendText}>{t('analytics.more', 'Nhiều')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#151929',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  daysLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  label: {
    color: '#5A5F7A',
    fontSize: 10,
    fontWeight: 'bold',
    width: BOX_SIZE,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  boxWrapper: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    padding: 2,
  },
  box: {
    flex: 1,
    borderRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    color: '#5A5F7A',
    fontSize: 10,
    marginHorizontal: 4,
  },
});
