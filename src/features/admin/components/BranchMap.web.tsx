import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { supabase } from '@/src/api/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface Branch {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location: string;
  inventory_health?: 'high' | 'medium' | 'low';
}

export const BranchMap = () => {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const getBranchDisplayName = (name: string) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower.includes('south') || lower.includes('miền nam') || lower.includes('hồ chí minh') || lower.includes('hcm')) {
      return t('admin.branch_south', 'South Branch - TP.HCM');
    }
    if (lower.includes('main') || lower.includes('chính') || lower.includes('hà nội') || lower.includes('hn')) {
      return t('admin.branch_main', 'Main Branch - Hà Nội');
    }
    return name;
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select(`
          *,
          branch_inventory (
            available_copies,
            total_copies
          )
        `)
        .eq('is_active', true);

      if (error) throw error;

      const processedBranches = data.map((branch: any) => {
        const totalAvailable = branch.branch_inventory?.reduce((sum: number, item: any) => sum + item.available_copies, 0) || 0;
        const totalCapacity = branch.branch_inventory?.reduce((sum: number, item: any) => sum + item.total_copies, 0) || 0;
        
        let health: 'high' | 'medium' | 'low' = 'high';
        const ratio = totalAvailable / (totalCapacity || 1);
        if (ratio < 0.2) health = 'low';
        else if (ratio < 0.5) health = 'medium';

        return {
          ...branch,
          inventory_health: health
        };
      });

      setBranches(processedBranches);
    } catch (error) {
      console.error("[BranchMap Web] Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMarkerColor = (health: string) => {
    switch (health) {
      case 'low': return '#EF4444';
      case 'medium': return '#F59E0B';
      default: return '#10B981';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A75F2" />
        <Text style={styles.loadingText}>{t('admin.loading_branch_list', 'Đang tải danh sách chi nhánh...')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.webHeader}>
        <Ionicons name="map-outline" size={20} color="#3A75F2" />
        <Text style={styles.webTitle}>{t('admin.branch_inventory_status', 'Trạng thái Tồn kho Chi nhánh')}</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollArea}>
        {branches.map((branch) => (
          <View key={branch.id} style={styles.branchCard}>
            <View style={[styles.healthIndicator, { backgroundColor: getMarkerColor(branch.inventory_health || 'high') }]} />
            <Text style={styles.branchName} numberOfLines={1}>{getBranchDisplayName(branch.name)}</Text>
            <Text style={styles.branchLocation} numberOfLines={1}>{branch.location}</Text>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, { color: getMarkerColor(branch.inventory_health || 'high') }]}>
                {branch.inventory_health === 'low'
                  ? t('admin.status_low', 'Cảnh báo: Thấp')
                  : branch.inventory_health === 'medium'
                  ? t('admin.status_medium', 'Trung bình')
                  : t('admin.status_good', 'Tốt')}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>{t('admin.inventory_good', 'Tốt')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>{t('admin.inventory_warning', 'Cảnh báo')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>{t('admin.inventory_critical', 'Nguy cấp')}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#151929',
    borderWidth: 1,
    borderColor: '#1E2540',
    padding: 20,
    justifyContent: 'center',
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  webTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollArea: {
    gap: 12,
    paddingRight: 20,
  },
  branchCard: {
    width: 180,
    backgroundColor: '#0B0F1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  healthIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  branchName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  branchLocation: {
    color: '#8B8FA3',
    fontSize: 11,
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  loadingContainer: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151929',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  loadingText: {
    color: '#8B8FA3',
    marginTop: 12,
    fontSize: 14,
  },
  legend: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E2540',
    paddingTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#8B8FA3',
    fontSize: 10,
    fontWeight: '600',
  }
});
