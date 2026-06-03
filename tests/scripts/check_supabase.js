const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkSupabase() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const userId = '362c0bbd-3649-497f-9864-7ae9d60aa5f2';
  
  console.log(`Checking profile via REST for user: ${userId}`);
  
  try {
    const { data, error, status } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.log(`Error Status: ${status}`);
      console.log(`Error Message: ${error.message}`);
      console.log(`Error Code: ${error.code}`);
    } else {
      console.log('Profile found:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

checkSupabase();
