import { adminService } from '../features/admin/admin.service';

/**
 * Logistics Service (Proxy to Admin Service)
 * Maintained for backward compatibility with Librarian and Admin features
 */
export const logisticsService = {
  getAIRedistributionSuggestions: (lang?: string) => adminService.getAIRedistributionSuggestions(lang),
  executeTransfer: adminService.executeTransfer.bind(adminService),
  getBranchStock: adminService.getBranchStock.bind(adminService),
};

export type { RedistributionSuggestion } from '../features/admin/admin.types';
