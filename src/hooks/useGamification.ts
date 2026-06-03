import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';

export function useGamification(userId: string) {
  const [stats, setStats] = useState({
    points: 0,
    level: 1,
    currentLevelXP: 0,
    nextLevelXP: 1000
  });

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('xp, level')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const xp = data.xp || 0;
        const level = data.level || 1;
        
        // Simple level logic: Level 1 = 0-1000, Level 2 = 1000-2000, etc.
        const currentLevelXP = xp % 1000;
        const nextLevelXP = 1000;
        
        setStats({
          points: xp,
          level: level,
          currentLevelXP: currentLevelXP,
          nextLevelXP: nextLevelXP
        });
      }
    };

    fetchStats();

    // 2. Real-time listener for XP/Level updates
    const channelId = `gamification_${userId}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const xp = payload.new.xp || 0;
          const level = payload.new.level || 1;
          setStats({
            points: xp,
            level: level,
            currentLevelXP: xp % 1000,
            nextLevelXP: 1000
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useGamification] Subscribed to channel: ${channelId}`);
        }
      });

    return () => {
      console.log(`[useGamification] Cleaning up channel: ${channelId}`);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return stats;
}
