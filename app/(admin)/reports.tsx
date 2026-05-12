import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportService, MonthlyReportData } from '../../src/services/reportService';
import { LinearGradient } from 'expo-linear-gradient';
import { AnalyticsHeatmap } from '../../src/features/admin/components/AnalyticsHeatmap';
import { LogisticsRadar } from '../../src/features/admin/components/LogisticsRadar';
import { BranchMap } from '../../src/features/admin/components/BranchMap';
import { useTranslation } from 'react-i18next';

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  
  // Default to current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getMonthlyStats(selectedMonth);
      setReportData(data);
    } catch (error: any) {
      Alert.alert(t('common.error'), t('messages.fetch_report_failed', 'Không thể tải dữ liệu báo cáo: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!reportData) return;
    try {
      await reportService.exportToCSV(reportData);
    } catch (error: any) {
      Alert.alert(t('common.error'), t('messages.export_csv_failed', 'Không thể xuất file CSV: ') + error.message);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    try {
      await reportService.exportToPDF(reportData);
    } catch (error: any) {
      Alert.alert(t('common.error'), t('messages.export_pdf_failed', 'Không thể xuất file PDF: ') + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('tabs.reports')}</Text>
          <Text style={styles.subtitle}>{t('admin.reports_subtitle_month', 'Phân tích hoạt động thư viện tháng {{month}}', { month: selectedMonth })}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.fetchBtn}
            onPress={fetchReport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="analytics-outline" size={20} color="#FFF" />
                <Text style={styles.fetchBtnText}>{t('admin.generate_report_month', 'Tạo báo cáo tháng {{month}}', { month: selectedMonth })}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {reportData && (
          <View style={styles.reportContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('analytics.total_borrows', 'Lượt mượn')}</Text>
                <Text style={styles.statValue}>{reportData.borrowCount}</Text>
                <View style={[styles.trendBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="arrow-up" size={12} color="#10B981" />
                  <Text style={[styles.trendText, { color: '#10B981' }]}>{t('analytics.stable')}</Text>
                </View>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('analytics.total_returns', 'Lượt trả')}</Text>
                <Text style={styles.statValue}>{reportData.returnCount}</Text>
                <Text style={styles.statSubText}>{t('analytics.rate', 'Tỉ lệ:')} {reportData.borrowCount ? Math.round((reportData.returnCount / reportData.borrowCount) * 100) : 0}%</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('analytics.fine_revenue', 'Tiền phạt')}</Text>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{reportData.fineRevenue.toLocaleString()}</Text>
                <Text style={styles.statSubText}>VND</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('analytics.active_users', 'Hoạt động')}</Text>
                <Text style={styles.statValue}>{reportData.activeUsers}</Text>
                <Text style={styles.statSubText}>{t('roles.member', 'Thành viên')}</Text>
              </View>
            </View>

            <AnalyticsHeatmap 
              data={[
                { day: "2024-03-01", count: 2 },
                { day: "2024-03-05", count: 5 },
                { day: "2024-03-10", count: 3 },
                { day: "2024-04-15", count: 8 },
                { day: "2024-04-20", count: 4 },
              ]}
            />

            <LogisticsRadar 
              title={t('analytics.branch_distribution')}
              data={{
                labels: [
                  t('analytics.branches.center'),
                  t('analytics.branches.district_1'),
                  t('analytics.branches.district_7'),
                  t('analytics.branches.thu_duc'),
                  t('analytics.branches.binh_thanh')
                ],
                data: [0.9, 0.6, 0.4, 0.8, 0.5]
              }}
            />

            <BranchMap />

            <View style={styles.exportSection}>
              <Text style={styles.sectionTitle}>{t('admin.export_data', 'Xuất dữ liệu')}</Text>
              <View style={styles.exportButtons}>
                <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
                  <LinearGradient
                    colors={['#3A75F2', '#2563EB']}
                    style={styles.gradientBtn}
                  >
                    <Ionicons name="document-text-outline" size={20} color="#FFF" />
                    <Text style={styles.exportBtnText}>CSV Excel</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.gradientBtn}
                  >
                    <Ionicons name="print-outline" size={20} color="#FFF" />
                    <Text style={styles.exportBtnText}>PDF Report</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  scrollContent: { padding: 20 },
  header: { marginBottom: 24 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#8A8F9E', fontSize: 14, marginTop: 4 },
  controls: { marginBottom: 24 },
  fetchBtn: {
    backgroundColor: '#3A75F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10
  },
  fetchBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  reportContainer: { gap: 24 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  statBox: {
    backgroundColor: '#151929',
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E2540'
  },
  statLabel: { color: '#8A8F9E', fontSize: 12, marginBottom: 8 },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  statSubText: { color: '#8A8F9E', fontSize: 11, marginTop: 4 },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8
  },
  trendText: { fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  exportSection: { marginTop: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  exportButtons: { flexDirection: 'row', gap: 12 },
  exportBtn: { flex: 1 },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8
  },
  exportBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
});
