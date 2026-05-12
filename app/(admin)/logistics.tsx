import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";


export default function LogisticsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.logistics')}</Text>
        <Text style={styles.subtitle}>{t('admin.logistics_subtitle')}</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard icon={<MaterialCommunityIcons name="truck-delivery" color="#3A75F2" size={24} />} label={t('admin.active_deliveries')} value="12" />
        <StatCard icon={<MaterialCommunityIcons name="package-variant-closed" color="#10B981" size={24} />} label={t('admin.in_transit')} value="45" />
        <StatCard icon={<MaterialCommunityIcons name="clock-outline" color="#F59E0B" size={24} />} label={t('common.pending')} value="8" />
        <StatCard icon={<MaterialCommunityIcons name="check-circle-outline" color="#8B5CF6" size={24} />} label={t('admin.delivered')} value="124" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.recent_activity')}</Text>
        <ActivityItem 
          title={t('admin.batch_delivered', { id: '1024' })} 
          time={t('common.hours_ago', { hours: 2 })} 
          location={t('admin.central_library')} 
          status={t('librarian.status_completed')}
          statusType="completed"
        />
        <ActivityItem 
          title={t('admin.new_shipment_dispatched')} 
          time={t('common.hours_ago', { hours: 5 })} 
          location={t('admin.west_wing_depot')} 
          status={t('admin.status_in_progress')}
          statusType="progress"
        />
        <ActivityItem 
          title={t('admin.pickup_scheduled')} 
          time={t('common.yesterday')} 
          location={t('admin.main_warehouse')} 
          status={t('admin.status_scheduled')}
          statusType="scheduled"
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityItem({ title, time, location, status, statusType }: { title: string, time: string, location: string, status: string, statusType?: string }) {
  return (
    <View style={styles.activityItem}>
      <View style={styles.activityHeader}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityTime}>{time}</Text>
      </View>
      <View style={styles.activityDetails}>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6B7280" />
          <Text style={styles.detailText}>{location}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusType === 'completed' ? '#065F46' : '#1E3A8A' }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 16,
    color: "#8B8FA3",
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#161B2E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  statIcon: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 14,
    color: "#8B8FA3",
    marginTop: 4,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  activityItem: {
    backgroundColor: "#161B2E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  activityTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  activityDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#8B8FA3",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
