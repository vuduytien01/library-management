import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { membersService } from '../../features/members/member-service';
import { booksService } from '../../features/books/books.service';
import { BorrowRecord } from '../../features/members/members.types';
import { Book } from '../../hooks/library/types';

export type BookWithInventory = Book & {
  created_at: string;
  branch_inventory: Array<{
    branch_id: string;
    total_copies: number;
    available_copies: number;
    branches: {
      name: string;
      location: string;
      province_v2_id?: number;
    };

  }>;
};

export type CollectionType = 'trending' | 'new' | 'foryou' | 'top_rated';

export const useLibraryKernel = () => {
  const queryClient = useQueryClient();
  const profile = useAuthStore(state => state.profile);
  const userId = profile?.id;

  // 1. Fetch Core Data
  const { data: systemConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => membersService.getSystemConfig(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: myBorrows = [] } = useQuery<BorrowRecord[]>({
    queryKey: ['my-borrows', userId],
    enabled: !!userId,
    queryFn: () => membersService.getMyBorrows(userId!),
  });

  const { data: allBooks = [], isLoading: isLoadingBooks } = useQuery<BookWithInventory[]>({
    queryKey: ['books-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*, branch_inventory(*, branches(*))');
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Computed Logic (Rule Engine)
  const stats = useMemo(() => {
    const activeBorrows = myBorrows.filter(b => b.status === 'BORROWED');
    const overdueBorrows = activeBorrows.filter(b => b.due_date && new Date(b.due_date) < new Date());
    const totalFine = myBorrows.reduce((acc, b) => acc + (b.estimated_fine || 0), 0);
    
    return {
      activeCount: activeBorrows.length,
      overdueCount: overdueBorrows.length,
      totalFine,
      limitReached: activeBorrows.length >= (systemConfig?.max_books || 5),
      hasOverdue: overdueBorrows.length > 0,
    };
  }, [myBorrows, systemConfig]);

  const canBorrow = (isbn: string) => {
    const book = allBooks.find(b => b.isbn === isbn);
    if (!book) return { allowed: false, reason: 'Không tìm thấy sách' };
    
    if (stats.limitReached) return { allowed: false, reason: `Bạn đã đạt giới hạn mượn (${systemConfig?.max_books} cuốn)` };
    if (stats.hasOverdue) return { allowed: false, reason: 'Bạn đang có sách quá hạn chưa trả' };
    
    // Check global inventory (Min 3 copies protection - if required by user)
    const totalCopies = book.branch_inventory?.reduce((sum, inv) => sum + (inv.total_copies || 0), 0) || 0;
    const availableCopies = book.branch_inventory?.reduce((sum, inv) => sum + (inv.available_copies || 0), 0) || 0;
    
    // Rule: Must keep at least 1 copy or follow a minimum copies rule
    if (availableCopies <= 0) return { allowed: false, reason: 'Sách đã hết bản sao khả dụng' };
    
    return { allowed: true };
  };

  // 3. Smart Collections
  const getCollection = (type: CollectionType, limit = 10) => {
    switch (type) {
      case 'trending':
        // Mock trending logic based on random order or borrow count if available
        return [...allBooks].sort(() => 0.5 - Math.random()).slice(0, limit);
      case 'new':
        return [...allBooks]
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, limit);
      case 'top_rated':
        return [...allBooks]
          .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
          .slice(0, limit);
      case 'foryou':
        // This usually calls AI recommendations, we'll return a slice for now
        return allBooks.slice(0, limit);
      default:
        return allBooks.slice(0, limit);
    }
  };

  // 4. Mutations
  const borrowMutation = useMutation({
    mutationFn: async ({ isbn, branchId }: { isbn: string, branchId: string }) => {
      const check = canBorrow(isbn);
      if (!check.allowed) throw new Error(check.reason);
      return membersService.borrowBook(isbn, branchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-borrows'] });
      queryClient.invalidateQueries({ queryKey: ['books-all'] });
    }
  });

  return {
    allBooks,
    isLoading: isLoadingBooks,
    stats,
    getCollection,
    canBorrow,
    borrow: borrowMutation,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['books-all'] })
  };
};
