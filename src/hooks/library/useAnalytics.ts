import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "../../api/supabase";

export function useAnalytics() {
  const queryClient = useQueryClient();

  // --- Static/Global Analytics Queries ---
  const borrowingHeatmapQuery = useQuery({
    queryKey: ["borrowing-heatmap"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_borrow_heatmap")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const retentionStatsQuery = useQuery({
    queryKey: ["retention-stats"],
    queryFn: async () => ({
      active_members: 124,
      return_rate: 92,
      new_members_this_month: 15,
      avg_borrow_duration: 12,
    }),
  });

  const inventoryHealthQuery = useQuery({
    queryKey: ["inventory-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("generate_library_report", {
        report_type: "INVENTORY",
      });
      if (error) throw error;
      return data || { out_of_stock_count: 0, dead_stock_count: 0 };
    },
  });

  const peakHoursQuery = useQuery({
    queryKey: ["peak-hours"],
    queryFn: async () =>
      Array.from({ length: 12 }, (_, i) => ({
        hour: (i * 2 + 8) % 24,
        count: Math.floor(Math.random() * 50) + 10,
      })),
  });

  const predictedDemandQuery = useQuery({
    queryKey: ["predicted-demand"],
    queryFn: async () => ({
      predictions: [
        {
          title: "Tâm Lý Học Tội Phạm",
          category: "Tâm lý",
          recentBorrows: 45,
          borrows: 890,
        },
        {
          title: "Kinh Tế Học Cơ Bản",
          category: "Kinh tế",
          recentBorrows: 38,
          borrows: 750,
        },
        {
          title: "Nhà Giả Kim",
          category: "Văn học",
          recentBorrows: 32,
          borrows: 1200,
        },
      ],
      trendingCategories: [
        { name: "Công nghệ", count: 156 },
        { name: "Kỹ năng sống", count: 142 },
        { name: "Tiểu thuyết", count: 98 },
      ],
      recommendations: [
        {
          id: "1",
          type: "PURCHASE",
          suggestion_text:
            'Mua thêm 10 cuốn "Tâm Lý Học Tội Phạm" cho chi nhánh Quận 1',
          confidence_score: 0.95,
          metadata: { borrow_velocity: "Very High" },
        },
      ],
    }),
  });

  const deepInsightsQuery = useQuery({
    queryKey: ["deep_insights"],
    queryFn: async () => {
      const { data: rawStats, error: statsError } = await supabase.rpc(
        "get_library_stats_v2",
      );
      if (statsError) console.error("Stats RPC Error:", statsError);

      const stats = rawStats?.[0]?.get_library_stats_v2 ||
        rawStats || { active_members: 124, overdue_count: 5 };
      const { data: forecastData } = await supabase
        .from("book_demand_forecast")
        .select("*")
        .order("confidence", { ascending: false })
        .limit(10);

      const demand = (forecastData || []).map((f: any) => ({
        book_title: f.title,
        confidence: f.confidence,
        velocity: f.velocity,
        predicted_growth: f.predicted_growth,
        recommendation: f.recommendation,
      }));

      return {
        stats,
        demand:
          demand.length > 0
            ? demand
            : [
                {
                  book_title: "Tâm Lý Học Tội Phạm",
                  confidence: 0.89,
                  velocity: 4.5,
                  predicted_growth: 25,
                  recommendation: "Mua thêm 5 cuốn",
                },
                {
                  book_title: "Kinh Tế Học Cơ Bản",
                  confidence: 0.82,
                  velocity: 3.2,
                  predicted_growth: 15,
                  recommendation: "Luân chuyển từ chi nhánh 2",
                },
              ],
      };
    },
  });

  return useMemo(() => {
    const wrap = (q: any) => () => q;
    return {
      getBorrowingHeatmap: wrap(borrowingHeatmapQuery),
      getRetentionStats: wrap(retentionStatsQuery),
      getInventoryHealth: wrap(inventoryHealthQuery),
      getPeakHours: wrap(peakHoursQuery),
      getPredictedDemand: wrap(predictedDemandQuery),
      getDeepInsights: wrap(deepInsightsQuery),
      getGenres: (userId: string | undefined) => ({
        queryKey: ["analytics_genres", userId],
        queryFn: async () => {
          const { data, error } = await supabase.rpc("get_member_genres", {
            p_user_id: userId,
          });
          if (error) throw error;
          return data || [];
        },
        enabled: !!userId,
      }),
      getActivity: (userId: string | undefined) => ({
        queryKey: ["analytics_activity", userId],
        queryFn: async () => {
          const { data, error } = await supabase.rpc("get_member_activity", {
            p_user_id: userId,
          });
          if (error) throw error;
          return data || [];
        },
        enabled: !!userId,
      }),
      getMonthly: (userId: string | undefined) => ({
        queryKey: ["analytics_monthly", userId],
        queryFn: async () => {
          const { data, error } = await supabase.rpc("get_member_monthly", {
            p_user_id: userId,
          });
          if (error) throw error;
          return {
            labels: (data || []).map((row: any) => row.month),
            datasets: [{ data: (data || []).map((row: any) => row.count) }],
          };
        },
        enabled: !!userId,
      }),
    };
  }, [
    borrowingHeatmapQuery.data,
    borrowingHeatmapQuery.status,
    retentionStatsQuery.data,
    retentionStatsQuery.status,
    inventoryHealthQuery.data,
    inventoryHealthQuery.status,
    peakHoursQuery.data,
    peakHoursQuery.status,
    predictedDemandQuery.data,
    predictedDemandQuery.status,
    deepInsightsQuery.data,
    deepInsightsQuery.status,
  ]);
}
