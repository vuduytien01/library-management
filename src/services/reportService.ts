import { supabase } from '../api/supabase';

export interface MonthlyReportData {
  borrowCount: number;
  returnCount: number;
  fineRevenue: number;
  activeUsers: number;
  branchInventory: any[];
}

export const reportService = {
  async getMonthlyStats(month: string): Promise<MonthlyReportData> {
    // month is 'YYYY-MM'
    const startOfMonth = `${month}-01T00:00:00Z`;
    const endOfMonth = new Date(new Date(month + '-01').setMonth(new Date(month + '-01').getMonth() + 1)).toISOString();

    const [borrows, returns, fines, profiles] = await Promise.all([
      supabase.from('borrows').select('id', { count: 'exact' }).gte('created_at', startOfMonth).lt('created_at', endOfMonth),
      supabase.from('borrows').select('id', { count: 'exact' }).eq('status', 'RETURNED').gte('updated_at', startOfMonth).lt('updated_at', endOfMonth),
      supabase.from('borrows').select('fine_amount').gte('updated_at', startOfMonth).lt('updated_at', endOfMonth),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'MEMBER')
    ]);

    const fineRevenue = fines.data?.reduce((sum, b) => sum + (b.fine_amount || 0), 0) || 0;

    return {
      borrowCount: borrows.count || 0,
      returnCount: returns.count || 0,
      fineRevenue,
      activeUsers: profiles.count || 0,
      branchInventory: [
        { id: '1', name: 'Chi nhánh Trung Tâm', location: 'Quận 1, TP.HCM', available_copies: 45, total_copies: 50 },
        { id: '2', name: 'Chi nhánh Quận 7', location: 'Phú Mỹ Hưng, Q7', available_copies: 12, total_copies: 40 },
        { id: '3', name: 'Chi nhánh Thủ Đức', location: 'TP. Thủ Đức', available_copies: 30, total_copies: 45 },
        { id: '4', name: 'Chi nhánh Bình Thạnh', location: 'Q. Bình Thạnh', available_copies: 8, total_copies: 35 },
      ]
    };
  },

  async exportToCSV(data: MonthlyReportData) {
    console.log('Exporting to CSV:', data);
    // In a real app, this would use a CSV library and FileSystem
    return true;
  },

  async exportToPDF(data: MonthlyReportData) {
    console.log('Exporting to PDF:', data);
    // In a real app, this would use a PDF library
    return true;
  }
};
