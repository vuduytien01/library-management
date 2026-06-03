import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  const { record } = await req.json();
  const bookCategory = record.category;

  if (!bookCategory) {
    return new Response(JSON.stringify({ message: "No category for book" }));
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Find users interested in this category
  const { data: users, error } = await supabase
    .from('profiles')
    .select('push_token')
    .not('push_token', 'is', null)
    .contains('favorite_genres', [bookCategory]);

  if (error || !users || users.length === 0) {
    return new Response(JSON.stringify({ message: "No interested users found" }));
  }

  const notifications = users.map(u => ({
    to: u.push_token,
    sound: 'default',
    title: 'Sách mới dành cho bạn! ✨',
    body: `Tựa sách "${record.title}" thuộc thể loại "${bookCategory}" vừa cập bến thư viện. Xem ngay!`,
    data: { url: '/(member)/search', isbn: record.isbn },
  }));

  // Send in batches of 100 (Expo limit)
  for (let i = 0; i < notifications.length; i += 100) {
    const batch = notifications.slice(i, i + 100);
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
  }

  return new Response(JSON.stringify({ sent: notifications.length }));
});
