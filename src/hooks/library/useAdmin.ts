import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../../features/admin/admin.service";
import { useAuthStore } from "../../store/useAuthStore";

export function useAdmin() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const isStaff = profile?.role === "ADMIN" || profile?.role === "LIBRARIAN";

  // --- Borrows Management ---
  const allBorrowsQuery = useQuery({
    queryKey: ["all-borrows"],
    queryFn: () => adminService.getAllBorrows(),
    enabled: isStaff,
  });

  const approveBorrow = useMutation({
    mutationFn: (recordId: string) =>
      adminService.approveBorrow(recordId, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-borrows"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const rejectBorrow = useMutation({
    mutationFn: ({ recordId, reason }: { recordId: string; reason: string }) =>
      adminService.rejectBorrow(recordId, profile!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-borrows"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  // --- Logistics ---
  const transfersQuery = useQuery({
    queryKey: ["inventory_transfers"],
    queryFn: () => adminService.getAllTransfers(),
    enabled: isStaff,
  });

  const logisticsSuggestionsQuery = useQuery({
    queryKey: ["logistics_suggestions"],
    queryFn: () => adminService.getAIRedistributionSuggestions(),
    enabled: false,
  });

  const executeTransfer = useMutation({
    mutationFn: (params: {
      isbn: string;
      fromBranchId: string;
      toBranchId: string;
      quantity: number;
    }) =>
      adminService.executeTransfer(
        params.isbn,
        params.fromBranchId,
        params.toBranchId,
        params.quantity,
        profile!.id,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["logistics_suggestions"] });
    },
  });

  const completeTransfer = useMutation({
    mutationFn: (id: string) => adminService.completeTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_transfers"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  // Sub-objects for domain organization
  const borrows = useMemo(
    () => ({
      listAll: () => allBorrowsQuery,
      approve: approveBorrow,
      reject: rejectBorrow,
    }),
    [allBorrowsQuery.data, allBorrowsQuery.status, approveBorrow, rejectBorrow],
  );

  const logistics = useMemo(
    () => ({
      getTransfers: () => transfersQuery,
      getAiSuggestions: () => logisticsSuggestionsQuery,
      executeTransfer,
      completeTransfer,
    }),
    [
      transfersQuery.data,
      transfersQuery.status,
      logisticsSuggestionsQuery.data,
      logisticsSuggestionsQuery.status,
      executeTransfer,
      completeTransfer,
    ],
  );

  const analytics = useMemo(
    () => ({
      // Functions that depend on parameters must still be functions,
      // but they shouldn't call useQuery themselves.
      // Instead, they should return data from a pre-fetched query if possible,
      // or we should use individual hooks for parameterized queries.
      getAnalytics: (range: string) => ({
        queryKey: ["analytics", range],
        queryFn: () => adminService.getAnalytics(range),
      }),
      getMonthlyStats: (month: string) => ({
        queryKey: ["monthly_stats", month],
        queryFn: () => adminService.getMonthlyStats(month),
      }),
    }),
    [],
  );

  return useMemo(
    () => ({
      borrows,
      logistics,
      analytics,
      staff: {
        searchMembers: (query: string) => ({
          queryKey: ["search_members", query],
          queryFn: () => adminService.searchMembers(query),
        }),
      },
    }),
    [borrows, logistics, analytics],
  );
}
