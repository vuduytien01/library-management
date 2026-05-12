import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../api/supabase';
import { membersService } from '../../features/members/member-service';

export function useSystem() {
  const queryClient = useQueryClient();

  // --- Metadata Settings ---
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({
    isbn: true, published_date: true, category: true, description: true, appendix: true, page_count: true, language: true, average_rating: true, edition: true,
  });

  useEffect(() => {
    AsyncStorage.getItem('metadata_display_settings').then(saved => {
      if (saved) setVisibleFields(JSON.parse(saved));
    });
  }, []);

  const saveMetadataSettings = useCallback(async (settings: Record<string, boolean>) => {
    await AsyncStorage.setItem('metadata_display_settings', JSON.stringify(settings));
    setVisibleFields(settings);
  }, []);

  // --- Connectivity ---
  const [isOnline, setIsOnline] = useState<boolean | null>(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try { await membersService.processQueue(); } finally { setIsSyncing(false); }
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      if (online && isOnline === false) handleSync();
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, [isOnline, handleSync]);

  const configQuery = useQuery({
    queryKey: ['system_config'],
    queryFn: () => membersService.getSystemConfig(),
  });

  const broadcastsQuery = useQuery({
    queryKey: ['broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('broadcasts').select('*').eq('active', true).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const readingRoomQuery = useQuery({
    queryKey: ['reading_room'],
    queryFn: async () => {
      const { data, error } = await supabase.from('reading_room_status').select('*').single();
      if (error) throw error;
      return data;
    }
  });

  return useMemo(() => {
    const wrap = (q: any) => () => q;
    return { 
      config: wrap(configQuery), 
      broadcasts: wrap(broadcastsQuery), 
      readingRoom: wrap(readingRoomQuery),
      metadata: { visibleFields, save: saveMetadataSettings },
      connectivity: { isOnline, isSyncing, triggerSync: handleSync }
    };
  }, [
    configQuery.data, configQuery.status,
    broadcastsQuery.data, broadcastsQuery.status,
    readingRoomQuery.data, readingRoomQuery.status,
    visibleFields, saveMetadataSettings, isOnline, isSyncing, handleSync
  ]);
}

