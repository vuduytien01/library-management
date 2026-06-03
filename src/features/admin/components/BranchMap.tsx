import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '@/src/api/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

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
  const [region, setRegion] = useState({
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

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
      
      if (processedBranches.length > 0) {
        setRegion({
          latitude: processedBranches[0].latitude,
          longitude: processedBranches[0].longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (error) {
      console.error("[BranchMap] Fetch error:", error);
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
        <Text style={styles.loadingText}>{t('admin.loading_branch_map', 'Đang tải bản đồ chi nhánh...')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        customMapStyle={darkMapStyle}
      >
        {branches.map((branch) => (
          <Marker
            key={branch.id}
            coordinate={{ latitude: branch.latitude, longitude: branch.longitude }}
            pinColor={getMarkerColor(branch.inventory_health || 'high')}
          >
            <Callout tooltip>
              <View style={styles.calloutContainer}>
                <Text style={styles.branchName}>{getBranchDisplayName(branch.name)}</Text>
                <Text style={styles.branchLocation}>{branch.location}</Text>
                <View style={styles.healthBadge}>
                  <View style={[styles.dot, { backgroundColor: getMarkerColor(branch.inventory_health || 'high') }]} />
                  <Text style={styles.healthText}>
                    {t('admin.inventory_status', 'Tồn kho')}: {
                      branch.inventory_health === 'low'
                        ? t('admin.inventory_restock', 'Cần bổ sung')
                        : branch.inventory_health === 'medium'
                        ? t('admin.inventory_medium', 'Trung bình')
                        : t('admin.inventory_good', 'Tốt')
                    }
                  </Text>
                </View>
                <View style={styles.divider} />
                <Text style={styles.viewMore}>{t('admin.view_details', 'Nhấn để xem chi tiết')}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      
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

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0B0F1A',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151929',
    borderRadius: 20,
  },
  loadingText: {
    color: '#8B8FA3',
    marginTop: 12,
    fontSize: 14,
  },
  calloutContainer: {
    width: 200,
    padding: 12,
    backgroundColor: '#151929',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2540',
  },
  branchName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  branchLocation: {
    color: '#8B8FA3',
    fontSize: 12,
    marginBottom: 8,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151929',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  healthText: {
    color: '#FFFFFF',
    fontSize: 11,
    marginLeft: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#2D344B',
    marginVertical: 8,
  },
  viewMore: {
    color: '#3A75F2',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(26, 29, 45, 0.9)',
    padding: 8,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    color: '#FFFFFF',
    fontSize: 10,
  }
});
