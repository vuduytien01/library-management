const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://objzfxyenfkxvfjmqrcj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ianpmeHllbmZreHZmam1xcmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTg3NTYsImV4cCI6MjA5MTIzNDc1Nn0.m6cQYSsgYH5b2FvgldBEewLcMbZx8S6iyaW2bvjhXco';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
  const email = `test_admin_${Date.now()}@test.com`;
  console.log("Testing Signup with:", email);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: email,
    password: 'password123',
    options: {
      data: {
        full_name: 'Test Administrator',
        registration_code: 'ADMIN_SECRET_2026'
      }
    }
  });

  if (signUpError) {
    console.error("Signup Error:", signUpError);
    return;
  }

  const id = signUpData.user.id;
  console.log("Signup Success. Fetching profile using session for user ID:", id);

  const { data: profileCheck, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  console.log("Fetch Result:", profileCheck, fetchError);
}

runTest();
