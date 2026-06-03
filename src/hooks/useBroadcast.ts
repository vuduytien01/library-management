import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';

export interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'promotion';
  created_at: string;
}

export function useBroadcast() {
  const [latestMessage, setLatestMessage] = useState<BroadcastMessage | null>(null);

  useEffect(() => {
    const fetchBroadcasts = async () => {
      const { data, error } = await supabase
        .from('broadcast_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setLatestMessage(data[0] as BroadcastMessage);
      }
    };

    fetchBroadcasts();

    // Real-time updates
    const channelId = `broadcast_messages_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast_messages' }, (payload) => {
        setLatestMessage(payload.new as BroadcastMessage);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissLatest = () => {
    setLatestMessage(null);
  };

  return { latestMessage, dismissLatest };
}
