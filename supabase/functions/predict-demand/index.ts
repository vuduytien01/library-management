import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get borrows from the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: records, error } = await supabase
      .from('borrow_records')
      .select(`
        id,
        created_at,
        book_isbn,
        book:books(title, category)
      `)
      .gte('created_at', ninetyDaysAgo.toISOString());

    if (error) throw error;

    // 2. Simple Demand Analysis
    const bookStats: Record<string, any> = {};
    const categoryStats: Record<string, number> = {};

    records.forEach(r => {
      const isbn = r.book_isbn;
      const category = r.book?.category || 'Unknown';
      
      // Book stats
      if (!bookStats[isbn]) {
        bookStats[isbn] = {
          title: r.book?.title,
          borrows: 0,
          recentBorrows: 0,
          category: category
        };
      }
      bookStats[isbn].borrows++;
      
      // Recent velocity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (new Date(r.created_at) > thirtyDaysAgo) {
        bookStats[isbn].recentBorrows++;
      }

      // Category stats
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });

    // 3. Identify "Hot Titles" (high velocity in last 30 days vs total)
    const predictions = Object.values(bookStats)
      .map(b => ({
        ...b,
        score: (b.recentBorrows * 2) + (b.borrows * 0.5) // Weighted score
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 4. Trending Categories
    const trendingCategories = Object.entries(categoryStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return new Response(JSON.stringify({ 
      predictions, 
      trendingCategories,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
