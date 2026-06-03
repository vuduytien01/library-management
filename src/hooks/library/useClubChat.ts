import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../api/supabase";
import { useAuthStore } from "../../store/useAuthStore";

export function useClubChat(clubId: string) {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const [lastReaction, setLastReaction] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!clubId || !profile) return;

    const channel = supabase.channel(`club_chat:${clubId}`, {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((u: any) => u.fullName);
        setOnlineCount(users.length);
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        setLastReaction(payload);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { fullName, isTyping } = payload;
        if (fullName === profile.fullName) return;
        setTypingUsers((prev) => {
          if (isTyping) {
            return prev.includes(fullName) ? prev : [...prev, fullName];
          } else {
            return prev.filter((u) => u !== fullName);
          }
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
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
  }, [clubId, profile]);

  const getMessages = () =>
    useQuery({
      queryKey: ["club_messages", clubId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("book_club_messages")
          .select(
            "*, profiles:user_id(fullName:full_name, avatarUrl:avatar_url)",
          )
          .eq("club_id", clubId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data || [];
      },
    });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from("book_club_messages")
        .insert({
          club_id: clubId,
          user_id: profile?.id,
          content,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club_messages", clubId] });
    },
  });

  const sendReaction = (emoji: string) => {
    supabase.channel(`club_chat:${clubId}`).send({
      type: "broadcast",
      event: "reaction",
      payload: { emoji, userId: profile?.id },
    });
  };

  const setTyping = (isTyping: boolean) => {
    supabase.channel(`club_chat:${clubId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { fullName: profile?.fullName, isTyping },
    });
  };

  return {
    getMessages,
    sendMessage,
    sendReaction,
    lastReaction,
    typingUsers,
    onlineCount,
    setTyping,
  };
}
