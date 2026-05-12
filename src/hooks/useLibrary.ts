import { useMemo } from 'react';
import { useMember, useAnnotations, useSocial, useBookClubs, useInteractions } from './library/useMember';
import { useClubChat } from './library/useClubChat';
import { useAdmin } from './library/useAdmin';
import { useContent } from './library/useContent';
import { useSystem } from './library/useSystem';
import { useAnalytics } from './library/useAnalytics';

import { Book } from '../features/books/books.types';
import { BorrowRecord, Annotation } from '../features/members/members.types';

export { useMember, useAdmin, useContent, useSystem, useAnnotations, useSocial, useBookClubs, useClubChat, useInteractions };
export { useAudiobook, useBook, useBookInventory, useSimilarBooks, useBookReviews } from './library/useContent';
export type { Book, BorrowRecord, Annotation };

import { useLibraryKernel } from '../services/library/useLibraryKernel';
import { useAudiobookKernel } from '../services/audiobook/useAudiobookKernel';

interface LibraryAPI {
  // Kernel Props
  allBooks: any[];
  isLoading: boolean;
  stats: any;
  getCollection: (type: any, limit?: number) => any[];
  canBorrow: (isbn: string) => any;
  borrow: any;
  refresh: () => void;

  // Legacy/Domain Props
  borrows: any;
  gamification: any;
  feed: any;
  analytics: any;
  admin: ReturnType<typeof useAdmin>;
  logistics: ReturnType<typeof useAdmin>['logistics'];
  books: any;
  audiobooks: any;
  recommendations: any;
  reviews: any;
  useBooks: any;
  syncBook: any;
  config: any;
  broadcasts: any;
  readingRoom: any;
  metadata: any;
  connectivity: any;
  bookClubs: any;
  useMember: typeof useMember;
  useAdmin: typeof useAdmin;
  useContent: typeof useContent;
  useSystem: typeof useSystem;
  useClubChat: typeof useClubChat;
  useBookClubs: typeof useBookClubs;
}

export function useLibrary(): LibraryAPI & { useAudiobookKernel: typeof useAudiobookKernel } {
  const member = useMember();
  const admin = useAdmin();
  const content = useContent();
  const system = useSystem();
  const analytics = useAnalytics();
  const bookClubs = useBookClubs();
  const libraryKernel = useLibraryKernel();

  // 1. Stabilize Member Domain
  const borrows = useMemo(() => ({
    ...member.borrows,
    listAll: admin.borrows.listAll,
    approve: admin.borrows.approve,
    reject: admin.borrows.reject,
  }), [member.borrows, admin.borrows]);

  const systemDomain = useMemo(() => ({
    config: system.config,
    broadcasts: system.broadcasts,
    readingRoom: system.readingRoom,
    metadata: system.metadata,
    connectivity: system.connectivity,
  }), [system.config, system.broadcasts, system.readingRoom, system.metadata, system.connectivity]);

  return useMemo(() => ({
    ...libraryKernel, // Library Kernel Integration
    useAudiobookKernel, // Audiobook Kernel Integration
    borrows,
    gamification: member.gamification,
    feed: member.feed,
    analytics: { ...analytics, ...member.analytics },
    admin,
    logistics: admin.logistics,
    books: content.books,
    audiobooks: content.audiobooks,
    recommendations: content.recommendations,
    reviews: content.reviews,
    useBooks: content.books.list,
    syncBook: content.books.sync,
    config: systemDomain.config,
    broadcasts: systemDomain.broadcasts,
    readingRoom: systemDomain.readingRoom,
    metadata: systemDomain.metadata,
    connectivity: systemDomain.connectivity,
    bookClubs,
    useMember,
    useAdmin,
    useContent,
    useSystem,
    useClubChat,
    useBookClubs
  }), [
    libraryKernel,
    borrows, 
    member.gamification, 
    member.feed, 
    analytics,
    member.analytics,
    admin, 
    content, 
    systemDomain, 
    bookClubs
  ]);
}
