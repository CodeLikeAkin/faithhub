
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTopics() {
  const { data, error } = await supabase
    .from('declarations')
    .select('topic_tags');

  if (error) {
    console.error('Error fetching declarations:', error);
    return;
  }

  const allTags = new Set();
  data.forEach(d => {
    if (d.topic_tags) {
      d.topic_tags.forEach(tag => allTags.add(tag));
    }
  });

  console.log('Available Topics:', Array.from(allTags));
}

checkTopics();
