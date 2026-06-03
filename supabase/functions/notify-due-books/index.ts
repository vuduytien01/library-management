import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 1. Get records due tomorrow (between 24h and 48h from now)
  const tomorrowStart = new Date();
  tomorrowStart.setHours(24, 0, 0, 0);
  const tomorrowEnd = new Date();
  tomorrowEnd.setHours(48, 0, 0, 0);

  const { data: dueRecords, error } = await supabase
    .from('borrow_records')
    .select(`
      id,
      due_date,
      book:books(title),
      profile:profiles(id, push_token)
    `)
    .eq('status', 'BORROWED')
    .gte('due_date', tomorrowStart.toISOString())
    .lt('due_date', tomorrowEnd.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!dueRecords || dueRecords.length === 0) {
    return new Response(JSON.stringify({ message: "No books due tomorrow" }));
  }

  // 2. Create in-app notifications for all due records
  const notificationsToInsert = dueRecords.map(r => ({
    user_id: r.profile.id,
    title: 'Nhắc nhở trả sách 📚',
    body: `Sách "${r.book.title}" sẽ hết hạn vào ngày mai. Đừng quên trả hoặc gia hạn nhé!`,
    type: 'DUE_SOON'
  }));

  if (notificationsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notificationsToInsert);
    
    if (insertError) console.error("Insert notification error:", insertError);
  }

  return new Response(JSON.stringify({ processed: notificationsToInsert.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
