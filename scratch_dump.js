require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('declarations')
      .select('id, sermon_id, declaration_text, timestamp_seconds, topic_tags, youtube_url_with_timestamp')
      .range(from, from + pageSize - 1);
    if (error) { console.error(error); process.exit(1); }
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  fs.writeFileSync('scratch_declarations.json', JSON.stringify(all));
  console.log('fetched', all.length);
})();
