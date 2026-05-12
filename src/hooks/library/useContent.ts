import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../api/supabase';
import { booksService } from '../../features/books/books.service';
import { useAuthStore } from '../../store/useAuthStore';
import { ai } from '../../core/ai';
import { Book } from '../../features/books/books.types';

export function useContent() {
  const queryClient = useQueryClient();
  const session = useAuthStore(state => state.session);
  const userId = session?.user.id;
  const { i18n } = useTranslation();
  const lang = i18n.language || 'vi';

  const localizeItem = useCallback(async (item: any, id: string) => {
    if (!item) return item;
    const hasLocalizedFields = (item.title_en && item.title_vi);
    let trans = {
      title_en: item.title_en, title_vi: item.title_vi,
      description_en: item.description_en, description_vi: item.description_vi,
      author_en: item.author_en, author_vi: item.author_vi,
      narrator_en: item.narrator_en, narrator_vi: item.narrator_vi
    };

    if (!hasLocalizedFields) {
      try {
        const cached = await AsyncStorage.getItem(`localized_meta_${id}`);
        if (cached) {
          trans = { ...trans, ...JSON.parse(cached) };
        } else {
          const aiTrans = await ai.translateMetadata(item.title, item.description || "", item.author, item.narrator);
          trans = { ...trans, ...aiTrans };
          await AsyncStorage.setItem(`localized_meta_${id}`, JSON.stringify(trans));
        }
      } catch (error) {
        console.warn(`Localization failed for ${id}:`, error);
      }
    }

    const isEn = i18n.language?.startsWith('en');
    let duration = item.duration;
    let duration_seconds = item.duration_seconds;
    
    if ((item.source_platform || item.chapters) && (!duration || duration === '0 phút')) {
      const calculated = booksService.calculateAudiobookDuration(item);
      if (calculated > 0) {
        duration_seconds = calculated;
        duration = booksService.formatDuration(calculated);
      }
    }

    return {
      ...item, duration, duration_seconds,
      title_en: trans.title_en || item.title, title_vi: trans.title_vi || item.title,
      description_en: trans.description_en || item.description, description_vi: trans.description_vi || item.description,
      author_en: trans.author_en || item.author, author_vi: trans.author_vi || item.author,
      narrator_en: trans.narrator_en || item.narrator, narrator_vi: trans.narrator_vi || item.narrator,
      title: isEn ? (trans.title_en || item.title) : (trans.title_vi || item.title),
      description: isEn ? (trans.description_en || item.description) : (trans.description_vi || item.description),
      author: isEn ? (trans.author_en || item.author) : (trans.author_vi || item.author),
      narrator: isEn ? (trans.narrator_en || item.narrator) : (trans.narrator_vi || item.narrator),
    };
  }, [i18n.language]);

  const booksQuery = useQuery<Book[]>({
    queryKey: ['books', lang],
    queryFn: async () => {
      const { data, error } = await supabase.from('books').select('*').order('title');
      if (error) throw error;
      return Promise.all((data || []).map(book => localizeItem(book, book.isbn)));
    }
  });

  const audiobooksQuery = useQuery({
    queryKey: ['audiobooks', 20, lang],
    queryFn: async () => {
      const list = await booksService.browseAudiobooks(20);
      return Promise.all(list.map(ab => localizeItem(ab, ab.id)));
    },
  });

  const addAudiobook = useMutation({
    mutationFn: async (audiobook: any) => {
      if (!audiobook.title_en || !audiobook.title_vi) {
        try {
          const trans = await ai.translateMetadata(audiobook.title, audiobook.description || "", audiobook.author, audiobook.narrator);
          audiobook = { ...audiobook, ...trans };
        } catch(e) { console.warn("Auto-translate failed during add:", e); }
      }
      const { data, error } = await supabase.from('audiobook_metadata').insert([audiobook]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audiobooks'] })
  });

  const updateAudiobook = useMutation({
    mutationFn: async ({ id, ...audiobook }: any) => {
      const { data, error } = await supabase.from('audiobook_metadata').update(audiobook).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ['audiobooks'] });
      queryClient.invalidateQueries({ queryKey: ['audiobook', v.id] });
    }
  });

  const deleteAudiobook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('audiobook_metadata').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audiobooks'] })
  });

  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', userId, lang],
    enabled: !!userId,
    queryFn: async () => {
      const list = await booksService.getSemanticRecommendations(userId!, 5);
      return Promise.all(list.map(book => localizeItem(book, book.isbn)));
    }
  });

  const addReview = useMutation({
    mutationFn: async (review: any) => {
      const { data, error } = await supabase.from('reviews').upsert([{ ...review, user_id: userId }]);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => queryClient.invalidateQueries({ queryKey: ['reviews', v.book_isbn] })
  });

  const syncBook = useMutation({
    mutationFn: (isbn: string) => booksService.syncBookMetadata(isbn),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['books'] })
  });

  return useMemo(() => {
    const wrap = (q: any) => () => q;
    return {
      books: { 
        list: wrap(booksQuery), 
        sync: syncBook 
      },
      audiobooks: { 
        list: wrap(audiobooksQuery), 
        add: addAudiobook, 
        update: updateAudiobook, 
        delete: deleteAudiobook 
      },
      recommendations: { get: wrap(recommendationsQuery) },
      reviews: { add: addReview }
    };
  }, [
    booksQuery.data, booksQuery.status,
    audiobooksQuery.data, audiobooksQuery.status,
    recommendationsQuery.data, recommendationsQuery.status,
    syncBook, addAudiobook, updateAudiobook, deleteAudiobook, addReview
  ]);
}

export function useBook(isbn: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'vi';
  return useQuery({
    queryKey: ['book', isbn, lang],
    queryFn: async () => {
      const { data, error } = await supabase.from('books').select('*, branch_inventory(*)').eq('isbn', isbn).single();
      if (error) throw error;
      return data;
    },
    enabled: !!isbn
  });
}

export function useAudiobook(id: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'vi';
  return useQuery({
    queryKey: ['audiobook', id, lang],
    queryFn: async () => {
      const { data, error } = await supabase.from('audiobook_metadata').select('*, book:books(title, author, description, cover_url)').eq('id', id).single();
      if (error) throw error;
      const enriched = await booksService.enrichWithBookMetadata([data]);
      return enriched[0];
    },
    enabled: !!id
  });
}

export function useBookInventory(isbn: string) {
  return useQuery({
    queryKey: ['branch_inventory', isbn],
    queryFn: async () => {
      const { data, error } = await supabase.from('branch_inventory').select('*, branches(*)').eq('isbn', isbn);
      if (error) throw error;
      return data || [];
    },
    enabled: !!isbn
  });
}

export function useSimilarBooks(isbn: string, limit = 5) {
  return useQuery({
    queryKey: ['similar_books', isbn],
    queryFn: async () => {
      const list = await booksService.getSimilarBooks(isbn);
      return list.slice(0, limit);
    },
    enabled: !!isbn
  });
}

export function useBookReviews(isbn: string) {
  return useQuery({
    queryKey: ['reviews', isbn],
    queryFn: async () => {
      const { data, error } = await supabase.from('reviews').select('*, profiles(fullName:full_name, avatarUrl:avatar_url)').eq('book_isbn', isbn).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!isbn
  });
}
