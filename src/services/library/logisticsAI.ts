import { BookWithInventory } from "./useLibraryKernel";
import { PROVINCES_34, StrategicRegion } from "../../constants/logistics";

export interface TransferSuggestion {
  fromBranchId: string;
  fromBranchName: string;
  availableCopies: number;
  region: StrategicRegion;
  distanceTier: 'INTRA_PROVINCE' | 'INTRA_REGION' | 'NATIONAL';
}


export const logisticsAI = {
  /**
   * Suggests the best source branch for book transfer within the same strategic region.
   */
  suggestTransfer(book: BookWithInventory, targetProvinceId: number): TransferSuggestion | null {
    const targetProvince = PROVINCES_34.find(p => p.id === targetProvinceId);
    if (!targetProvince) return null;

    const targetRegion = targetProvince.region;

    // 1. Filter branches in the same strategic region that have at least 2 copies (to keep 1)
    const candidates = book.branch_inventory
      .filter(inv => {
        const branchProvince = PROVINCES_34.find(p => p.id === inv.branches.province_v2_id);
        return branchProvince && branchProvince.region === targetRegion && inv.available_copies > 1;
      })
      .map(inv => {
        const isIntraProvince = inv.branches.province_v2_id === targetProvinceId;
        return {
          fromBranchId: inv.branch_id,
          fromBranchName: inv.branches.name,
          availableCopies: inv.available_copies,
          region: targetRegion,
          distanceTier: (isIntraProvince ? 'INTRA_PROVINCE' : 'INTRA_REGION') as 'INTRA_PROVINCE' | 'INTRA_REGION',
          provinceId: inv.branches.province_v2_id
        };
      });

    if (candidates.length === 0) {
      // 3. National Fallback: Search all branches regardless of region
      const nationalCandidates = book.branch_inventory
        .filter(inv => inv.available_copies > 1)
        .map(inv => {
          const province = PROVINCES_34.find(p => p.id === inv.branches.province_v2_id);
          return {
            fromBranchId: inv.branch_id,
            fromBranchName: inv.branches.name,
            availableCopies: inv.available_copies,
            region: province?.region || 'NORTHERN_HIGHLANDS', // Fallback
            distanceTier: 'NATIONAL' as const,
          };
        });

      if (nationalCandidates.length === 0) return null;
      
      // Pick the one with the most copies for national stability
      return nationalCandidates.sort((a, b) => b.availableCopies - a.availableCopies)[0];
    }

    // 2. Sorting Logic for Regional:
    // Priority 1: Same Province (INTRA_PROVINCE)
    // Priority 2: Most available copies
    return candidates.sort((a, b) => {
      if (a.distanceTier !== b.distanceTier) {
        return a.distanceTier === 'INTRA_PROVINCE' ? -1 : 1;
      }
      return b.availableCopies - a.availableCopies;
    })[0];
  }
};


