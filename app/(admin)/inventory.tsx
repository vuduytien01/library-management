import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/api/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { logisticsService } from '../../src/services/logisticsService';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUndoStore } from '../../src/store/useUndoStore';

export default function AdminInventory() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { queueAction } = useUndoStore();
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const getBranchDisplayName = (name: string) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower.includes('south') || lower.includes('miền nam') || lower.includes('hồ chí minh') || lower.includes('hcm')) {
      return t('admin.branch_south', 'Chi nhánh phía Nam - TP.HCM');
    }
    if (lower.includes('main') || lower.includes('chính') || lower.includes('hà nội') || lower.includes('hn')) {
      return t('admin.branch_main', 'Chi nhánh Chính - Hà Nội');
    }
    return name;
  };

  // 1. Fetch Branches
  const { data: branches, isLoading: loadingBranches } = useQuery({
    queryKey: ['admin_branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // 2. Fetch AI Suggestions
  const { data: suggestions, refetch: refetchSuggestions } = useQuery({
    queryKey: ['inventory_suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suggestions')
        .select('*, branch:branches(name), book:books(title)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  // 3. Fetch Global Inventory Stats
  const { data: stats } = useQuery({
    queryKey: ['inventory_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branch_inventory').select('total_copies, available_copies');
      if (error) throw error;
      
      const total = data.reduce((acc, curr) => acc + curr.total_copies, 0);
      const available = data.reduce((acc, curr) => acc + curr.available_copies, 0);
      return { total, available, outOfStock: data.filter(i => i.available_copies === 0).length };
    }
  });

  // 4. Run AI Intelligence Mutation
  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('inventory-intelligence');
      if (error) throw error;
      refetchSuggestions();
    } catch (err: any) {
      Alert.alert(t('common.error'), t('admin.ai_analysis_failed') + ': ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 5. Execute Transfer
  const { mutateAsync: executeTransfer, isPending: isTransferring } = useMutation({
    mutationFn: async (suggestion: any) => {
      const { book_isbn, metadata } = suggestion;
      if (!metadata?.from_branch_id || !metadata?.to_branch_id) {
        throw new Error(t('admin.transfer_failed'));
      }
      
      const userId = useAuthStore.getState().profile?.id;
      if (!userId) throw new Error('Unauthorized');

      return await logisticsService.executeTransfer(
        book_isbn,
        metadata.from_branch_id,
        metadata.to_branch_id,
        metadata.quantity || 1,
        userId
      );
    },
    onSuccess: (data: any) => {
      if (data.success) {
        Alert.alert(t('common.success'), t('admin.transfer_success'));
        queryClient.invalidateQueries({ queryKey: ['inventory_stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin_branches'] });
        refetchSuggestions();
      } else {
        Alert.alert(t('common.error'), data.error || t('admin.transfer_failed'));
      }
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.message);
    }
  });

  const SuggestionCard = ({ item }: any) => (
    <View style={{
      backgroundColor: '#1E2540',
      borderRadius: 20,
      padding: 20,
      marginBottom: 12,
      borderWidth: 0,
      borderColor: 'transparent',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ backgroundColor: '#4F8EF720', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
          <Text style={{ color: '#4F8EF7', fontSize: 10, fontWeight: '800' }}>{t('librarian.ai_suggestion_badge')}</Text>
        </View>
        <Text style={{ color: '#5A5F7A', fontSize: 11 }}>{new Date(item.created_at).toLocaleTimeString()}</Text>
      </View>
      
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', lineHeight: 22 }}>
        {item.suggestion_text}
      </Text>

      {item.metadata?.quantity && (
        <View style={{ flexDirection: 'row', marginTop: 16, alignItems: 'center' }}>
          <View style={{ flex: 1, backgroundColor: '#0B0F1A', padding: 12, borderRadius: 12, marginRight: 8 }}>
            <Text style={{ color: '#8B8FA3', fontSize: 10, textTransform: 'uppercase' }}>{t('common.from')}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 2 }}>{getBranchDisplayName(item.metadata.from_branch)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#4F8EF7" />
          <View style={{ flex: 1, backgroundColor: '#0B0F1A', padding: 12, borderRadius: 12, marginLeft: 8 }}>
            <Text style={{ color: '#8B8FA3', fontSize: 10, textTransform: 'uppercase' }}>{t('common.to')}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 2 }}>{getBranchDisplayName(item.metadata.to_branch)}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity 
        onPress={() => {
          queueAction({
            message: t('admin.transfer_pending', { 
              title: item.book?.title || item.book_isbn,
              from: getBranchDisplayName(item.metadata?.from_branch),
              to: getBranchDisplayName(item.metadata?.to_branch)
            }),
            onCommit: () => executeTransfer(item)
          });
        }}
        disabled={isTransferring}
        style={{ 
          backgroundColor: isTransferring ? '#2E3654' : '#4F8EF7', 
          paddingVertical: 12, 
          borderRadius: 12, 
          alignItems: 'center', 
          marginTop: 16,
          shadowColor: '#4F8EF7',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          opacity: isTransferring ? 0.6 : 1
        }}
      >
        {isTransferring ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('admin.transfer_now')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F1A' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>{t('tabs.inventory')}</Text>
          <Text style={{ color: '#8B8FA3', fontSize: 14, marginTop: 4 }}>{t('admin.inventory_subtitle')}</Text>
        </View>
        <TouchableOpacity 
          onPress={runAIAnalysis}
          disabled={isAnalyzing}
          style={{ width: 48, height: 48, backgroundColor: '#4F8EF720', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 0, borderColor: 'transparent' }}
        >
          {isAnalyzing ? <ActivityIndicator size="small" color="#4F8EF7" /> : <Ionicons name="sparkles" size={24} color="#4F8EF7" />}
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { queryClient.invalidateQueries(); }} tintColor="#4F8EF7" />}
      >
        {/* Stats Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
          <View style={{ backgroundColor: '#151929', borderRadius: 20, padding: 16, width: '48%', borderWidth: 0, borderColor: 'transparent' }}>
            <Text style={{ color: '#8B8FA3', fontSize: 12, fontWeight: '600' }}>{t('admin.total_copies')}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 8 }}>{stats?.total || 0}</Text>
          </View>
          <View style={{ backgroundColor: '#151929', borderRadius: 20, padding: 16, width: '48%', borderWidth: 0, borderColor: 'transparent' }}>
            <Text style={{ color: '#8B8FA3', fontSize: 12, fontWeight: '600' }}>{t('admin.available_copies')}</Text>
            <Text style={{ color: '#10B981', fontSize: 24, fontWeight: '800', marginTop: 8 }}>{stats?.available || 0}</Text>
          </View>
        </View>

        {/* AI Suggestions Section */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>{t('admin.ai_suggestions')}</Text>
            <Text style={{ color: '#4F8EF7', fontSize: 13, fontWeight: '600' }}>{t('common.view_all')}</Text>
          </View>
          
          {suggestions?.map((item: any) => (
            <SuggestionCard key={item.id} item={item} />
          ))}
          
          {(!suggestions || suggestions.length === 0) && (
            <View style={{ padding: 40, alignItems: 'center', backgroundColor: '#151929', borderRadius: 24, borderStyle: 'dashed', borderWidth: 0, borderColor: 'transparent' }}>
              <Ionicons name="analytics-outline" size={32} color="#5A5F7A" />
              <Text style={{ color: '#5A5F7A', fontSize: 14, textAlign: 'center', marginTop: 12 }}>{t('admin.no_suggestions_hint')}</Text>
            </View>
          )}
        </View>

        {/* Branches Section */}
        <View>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{t('admin.branch_list')}</Text>
          {branches?.map((branch: any) => (
            <View key={branch.id} style={{ 
              backgroundColor: '#151929', 
              borderRadius: 20, 
              padding: 16, 
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 0,
              borderColor: 'transparent'
            }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#4F8EF715', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Ionicons name="business" size={24} color="#4F8EF7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{getBranchDisplayName(branch.name)}</Text>
                <Text style={{ color: '#8B8FA3', fontSize: 12, marginTop: 2 }}>{branch.location}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5A5F7A" />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
