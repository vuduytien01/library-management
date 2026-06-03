import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    
    if (!record || !record.user_id) {
      return new Response("Invalid payload", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get user's push token
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', record.user_id)
      .single();

    if (error || !profile?.push_token) {
      return new Response(JSON.stringify({ message: "No push token for user" }), { status: 200 });
    }

    // 2. Map notification type to icon/action
    let data = { url: '/(member)/profile' };
    if (record.type === 'MESSAGE') data.url = '/(member)/community';
    if (record.type === 'DUE_SOON') data.url = '/(member)/history';
    if (record.type === 'LEVEL_UP') data.url = '/(member)/profile';
    if (record.type === 'BADGE') data.url = '/(member)/profile';

    // 3. Construct Expo notification
    const notification = {
      to: profile.push_token,
      sound: 'default',
      title: record.title,
      body: record.body,
      data: data,
      priority: 'high',
      channelId: 'default',
    };

    // 4. Send to Expo
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(notification),
    });

    const result = await response.json();
    console.log('Push result:', result);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
