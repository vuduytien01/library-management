import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://objzfxyenfkxvfjmqrcj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Need service role to bypass RLS for testing or use a real user token

async function testInteractions() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const testUserId = '795c000c-2cb7-4e67-93c6-31e12592e811';
  const testItemId = '9354ef53-fe88-485b-83af-029a4924a6bf';
  const testItemType = 'AUDIOBOOK';

  console.log('--- Testing Insert ---');
  const { data: insertData, error: insertError } = await supabase
    .from('user_interactions')
    .insert({
      user_id: testUserId,
      item_id: testItemId,
      item_type: testItemType,
      interaction_type: 'LIKE'
    });
  
  if (insertError) {
    console.error('Insert failed:', insertError);
  } else {
    console.log('Insert successful');
  }

  console.log('--- Testing Delete ---');
  const { data: deleteData, error: deleteError } = await supabase
    .from('user_interactions')
    .delete()
    .eq('user_id', testUserId)
    .eq('item_id', testItemId)
    .eq('interaction_type', 'LIKE');

  if (deleteError) {
    console.error('Delete failed:', deleteError);
  } else {
    console.log('Delete successful');
  }
}

// testInteractions();
