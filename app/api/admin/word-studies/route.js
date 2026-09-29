import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, fail, failFrom, ok } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

/**
 * GET ?sermon_id= -> that message's Greek / Hebrew / Aramaic word studies, and
 * whether it has been checked as needing none.
 */
export async function GET(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  const sermonId = new URL(req.url).searchParams.get('sermon_id') || '';
  if (!UUID_RE.test(sermonId)) return fail('Pick a message first.');
  try {
    const db = adminDb();
    const [{ data, error }, { data: sermon, error: sermonError }] = await Promise.all([
      db
        .from('sermon_word_studies')
        .select('id, word, language, original_script, meaning, reference, note, strongs_number, timestamp_seconds, youtube_url_with_timestamp')
        .eq('sermon_id', sermonId)
        .order('order_index', { ascending: true })
        .limit(200),
      db.from('sermons').select('word_studies_none').eq('id', sermonId).maybeSingle(),
    ]);
    if (error) throw error;
    if (sermonError) throw sermonError;
    return ok({ words: data || [], none_needed: !!sermon?.word_studies_none });
  } catch (e) {
    return failFrom(e, "Couldn't load the word studies.");
  }
}
