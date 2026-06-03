import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  const { record, old_record } = await req.json();

  // Only notify if is_locked changed from false to true
  if (record.is_locked && !old_record?.is_locked) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const pushToken = record.push_token;
    if (!pushToken) {
      return new Response(JSON.stringify({ message: "No push token for user" }));
    }

    const notification = {
      to: pushToken,
      sound: 'default',
      title: 'Tài khoản bị khóa 🔒',
      body: 'Tài khoản của bạn đã bị tạm khóa do nợ phí quá hạn. Vui lòng thanh toán để tiếp tục sử dụng.',
      data: { url: '/(member)/profile' },
    };

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });

    return new Response(JSON.stringify({ sent: true }));
  }

  return new Response(JSON.stringify({ sent: false }));
});
