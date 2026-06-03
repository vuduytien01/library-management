import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabase';
import { adminService } from '../../features/admin/admin.service';

export function useLibrarianAnalytics() {
  const queryClient = useQueryClient();

  const getSuggestions = () => useQuery({
    queryKey: ['librarian-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suggestions')
        .select('*, book:books(title)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const getGlobalTrends = () => useQuery({
    queryKey: ['global-trends'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_popular_genres');
      if (error) throw error;
      return {
        genres: data || []
      };
    }
  });

  const runIntelligence = useMutation({
    mutationFn: async (lang: string = 'vi') => {
      const suggestions = await adminService.getAIRedistributionSuggestions(lang);
      // Store suggestions in DB
      if (suggestions && suggestions.length > 0) {
        const { error } = await supabase.from('inventory_suggestions').insert(
          suggestions.map((s: any) => ({
            book_isbn: s.isbn,
            suggestion_text: s.reason,
            confidence_score: s.confidence || 0.8,
            type: 'TRANSFER_ADVICE',
            metadata: s
          }))
        );
        if (error) throw error;
      }
      return suggestions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['librarian-suggestions'] });
    }
  });

  const runPredictiveAnalysis = useMutation({
    mutationFn: async () => {
      // Simulate or call another AI service
      const { error } = await supabase.from('inventory_suggestions').insert([
        {
          suggestion_text: 'Nhu cầu sách "Kinh tế học" dự kiến tăng 40% trong tháng tới tại chi nhánh Quận 1.',
          suggestion_text_en: 'Demand for "Economics" books is expected to increase by 40% next month at District 1 branch.',
          confidence_score: 0.92,
          type: 'PREDICTIVE_HOT',
          metadata: { predicted_demand_increase: '40%', priority: 'HIGH' }
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['librarian-suggestions'] });
    }
  });

  return {
    getSuggestions,
    getGlobalTrends,
    runIntelligence,
    runPredictiveAnalysis
  };
}
