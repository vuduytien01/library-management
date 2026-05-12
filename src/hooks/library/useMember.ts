import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Alert } from "react-native";
import { supabase } from "../../api/supabase";
import { membersService } from "../../features/members/member-service";
import { Annotation, BorrowRecord } from "../../features/members/members.types";
import { useAuthStore } from "../../store/useAuthStore";

export function useMember() {
  const queryClient = useQueryClient();
  const session = useAuthStore(state => state.session);
  const profile = useAuthStore(state => state.profile);
  const userId = session?.user.id;
  const segments = useSegments();
  const router = useRouter();

  // --- Borrows ---
  const myBorrowsQuery = useQuery<BorrowRecord[]>({
    queryKey: ["my-borrows", userId],
    enabled: !!userId,
    queryFn: () => membersService.getMyBorrows(userId!),
  });

  const borrowBook = useMutation({
    mutationFn: ({ isbn, branchId }: { isbn: string; branchId: string }) =>
      membersService.borrowBook(isbn, branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["my-borrows"] });
    },
  });

  const returnBook = useMutation({
    mutationFn: async (isbn: string) => {
      const { data, error } = await supabase.rpc("return_book_v2", {
        p_isbn: isbn,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["my-borrows"] });
    },
  });

  const payFine = useMutation({
    mutationFn: ({ recordId, method }: { recordId: string; method: string }) =>
      membersService.payFine(recordId, method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-borrows"] });
    },
  });

  // --- Gamification ---
  const badgesQuery = useQuery({
    queryKey: ["badges"],
    queryFn: () => membersService.getAllBadges(),
  });

  const myBadgesQuery = useQuery({
    queryKey: ["user_badges", userId],
    enabled: !!userId,
    queryFn: () => membersService.getMyBadges(userId!),
  });

  // --- Feed & Notifications ---
  const communityFeedQuery = useQuery({
    queryKey: ["community_feed"],
    queryFn: async () => {
      const { data: borrows } = await supabase
        .from("borrow_records")
        .select(
          "id, borrowed_at, book_id, profiles:user_id(fullName:full_name, avatarUrl:avatar_url), book:books(title, isbn)",
        )
        .order("borrowed_at", { ascending: false })
        .limit(10);
      const { data: reviews } = await supabase
        .from("reviews")
        .select(
          "id, created_at, book_isbn, rating, profiles:user_id(fullName:full_name, avatarUrl:avatar_url), book:books(title)",
        )
        .order("created_at", { ascending: false })
        .limit(10);

      const activities = [
        ...(borrows || []).map((b: any) => ({
          id: b.id,
          type: "BORROW",
          userName: b.profiles?.fullName,
          bookTitle: b.book?.title,
          bookIsbn: b.book?.isbn,
          timestamp: b.borrowed_at,
          avatarUrl: b.profiles?.avatarUrl,
        })),
        ...(reviews || []).map((r: any) => ({
          id: r.id,
          type: "REVIEW",
          userName: r.profiles?.fullName,
          bookTitle: r.book?.title,
          bookIsbn: r.book_isbn,
          timestamp: r.created_at,
          rating: r.rating,
          avatarUrl: r.profiles?.avatarUrl,
        })),
      ];
      return activities
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 15);
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // --- Analytics ---
  const genresQuery = useQuery({
    queryKey: ["analytics_genres", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_genres", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data || [];
    },
  });

  const activityQuery = useQuery({
    queryKey: ["analytics_activity", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_activity", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data || [];
    },
  });

  const monthlyQuery = useQuery({
    queryKey: ["analytics_monthly", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_monthly", {
        p_user_id: userId,
      });
      if (error) throw error;
      return {
        labels: (data || []).map((d: any) => d.month),
        datasets: [{ data: (data || []).map((d: any) => d.count) }],
      };
    },
  });

  const borrowsDomain = useMemo(() => ({
    list: () => myBorrowsQuery,
    borrow: borrowBook,
    return: returnBook,
    pay: payFine,
  }), [myBorrowsQuery.data, myBorrowsQuery.status, borrowBook, returnBook, payFine]);

  const gamificationDomain = useMemo(() => ({ 
    getBadges: () => badgesQuery, 
    getMyBadges: () => myBadgesQuery, 
    getLeaderboard: (limit = 50) => ({
      queryKey: ["leaderboard", limit],
      queryFn: () => membersService.getLeaderboard(limit),
    })
  }), [badgesQuery.data, badgesQuery.status, myBadgesQuery.data, myBadgesQuery.status]);

  const feedDomain = useMemo(() => ({ 
    getCommunityFeed: () => communityFeedQuery, 
    listNotifications: () => notificationsQuery 
  }), [communityFeedQuery.data, communityFeedQuery.status, notificationsQuery.data, notificationsQuery.status]);

  const analyticsDomain = useMemo(() => {
    const wrap = (q: any) => () => q;
    return { 
      getGenres: wrap(genresQuery), 
      getActivity: wrap(activityQuery), 
      getMonthly: wrap(monthlyQuery) 
    };
  }, [genresQuery.data, genresQuery.status, activityQuery.data, activityQuery.status, monthlyQuery.data, monthlyQuery.status]);

  return useMemo(() => ({
    borrows: borrowsDomain,
    gamification: gamificationDomain,
    feed: feedDomain,
    analytics: analyticsDomain,
  }), [borrowsDomain, gamificationDomain, feedDomain, analyticsDomain]);
}

export function useAnnotations(isbn: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!isbn) return;
    try {
      const data = await membersService.getAnnotationsByBook(isbn);
      setAnnotations(data);
    } finally {
      setIsLoading(false);
    }
  }, [isbn]);

  useEffect(() => {
    fetch();
    const channelId = `ann_${isbn}_${Date.now()}`;
    const sub = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "annotations",
          filter: `book_isbn=eq.${isbn}`,
        },
        () => fetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [isbn, fetch]);

  const addAnnotation = useCallback((
    content: string,
    selection?: string,
    metadata?: any,
    color?: string,
    isPublic?: boolean,
  ) =>
    membersService.createAnnotation({
      book_isbn: isbn,
      content,
      selection,
      page_number: metadata?.page,
      color,
      is_public: isPublic,
    }), [isbn]);

  const removeAnnotation = useCallback(async (id: string) => {
    setAnnotations(prev => prev.filter((a: Annotation) => a.id !== id));
    try {
      await membersService.deleteAnnotation(id);
    } catch (error) {
      fetch();
      throw error;
    }
  }, [fetch]);

  return useMemo(() => ({
    annotations,
    isLoading,
    addAnnotation,
    removeAnnotation,
    setAnnotations,
    refresh: fetch,
  }), [annotations, isLoading, addAnnotation, removeAnnotation, fetch]);
}

export function useInteractions(userId?: string, itemType?: "BOOK" | "AUDIOBOOK") {
  return useQuery({
    queryKey: ["user_interactions", userId, itemType],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase.from("user_interactions").select("*").eq("user_id", userId!);
      if (itemType) query = query.eq("item_type", itemType);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSocial(itemId: string, itemType: "BOOK" | "AUDIOBOOK") {
  const profile = useAuthStore(state => state.profile);
  const queryClient = useQueryClient();

  const interactionsQuery = useQuery({
    queryKey: ["user_interactions", profile?.id, itemId, itemType],
    enabled: !!profile?.id && !!itemId,
    queryFn: () => membersService.getInteractions(profile!.id, itemId, itemType),
  });

  const interactions = interactionsQuery.data || [];
  const isLiked = interactions.some((i: any) => i.interaction_type === "LIKE");
  const isBookmarked = interactions.some((i: any) => i.interaction_type === "BOOKMARK");

  const toggle = useMutation({
    mutationFn: async (type: "LIKE" | "BOOKMARK") => {
      if (!profile?.id) return;
      const currentState = type === "LIKE" ? isLiked : isBookmarked;
      return membersService.toggleInteraction(
        profile.id,
        itemId,
        itemType,
        type,
        currentState
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_interactions"] });
    },
  });

  const toggleLike = useCallback(() => toggle.mutate("LIKE"), [toggle]);
  const toggleBookmark = useCallback(() => toggle.mutate("BOOKMARK"), [toggle]);

  return useMemo(() => ({
    isLiked,
    isBookmarked,
    toggleLike,
    toggleBookmark,
    isLoading: toggle.isPending,
  }), [isLiked, isBookmarked, toggleLike, toggleBookmark, toggle.isPending]);
}

export function useBookClubs() {
  const queryClient = useQueryClient();
  const profile = useAuthStore(state => state.profile);

  const listQuery = useQuery({
    queryKey: ["book_clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_clubs")
        .select("*, book_club_members(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((club) => ({
        ...club,
        member_count: (club.book_club_members as any)[0]?.count || 0,
      }));
    },
  });

  const myClubsQuery = useQuery({
    queryKey: ["my_book_clubs", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("book_club_members")
        .select("book_clubs(*)")
        .eq("user_id", profile!.id);
      return (data || []).map((item) => item.book_clubs);
    },
  });

  const create = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from("book_clubs")
        .insert({ name, description, created_by: profile?.id })
        .select()
        .single();
      if (error) throw error;
      
      await supabase.from("book_club_members").insert({ club_id: data.id, user_id: profile?.id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book_clubs"] });
      queryClient.invalidateQueries({ queryKey: ["my_book_clubs"] });
    },
  });

  const join = useMutation({
    mutationFn: async (clubId: string) => {
      const { error } = await supabase
        .from("book_club_members")
        .insert({ club_id: clubId, user_id: profile?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book_clubs"] });
      queryClient.invalidateQueries({ queryKey: ["my_book_clubs"] });
    },
  });

  return useMemo(() => ({
    list: () => listQuery,
    getMyClubs: () => myClubsQuery,
    create,
    join,
  }), [listQuery, myClubsQuery, create, join]);
}
