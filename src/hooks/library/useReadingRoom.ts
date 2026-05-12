import { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';
import { useAuthStore } from '../../store/useAuthStore';

export function useReadingRoom(isbn: string) {
  const profile = useAuthStore(state => state.profile);
  const [readers, setReaders] = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isbn || !profile) return;

    const channel = supabase.channel(`reading_room:${isbn}`, {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat();
        setReaders(users);
        setLiveCount(users.length);
        setIsLoading(false);
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        setReactions((prev) => [...prev, payload]);
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== payload.id));
        }, 3000);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: profile.id,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isbn, profile]);

  const sendReaction = (emoji: string) => {
    const reaction = {
      id: Date.now().toString(),
      emoji,
      user_id: profile?.id,
      user_name: profile?.fullName,
    };
    supabase.channel(`reading_room:${isbn}`).send({
      type: 'broadcast',
      event: 'reaction',
      payload: reaction,
    });
  };

  return { readers, liveCount, reactions, isLoading, sendReaction };
}
