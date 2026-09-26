import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, fail, failFrom, ok } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

/** GET ?sermon_id= -> that message's declarations, in the order they were spoken. */
export async function GET(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  const sermonId = new URL(req.url).searchParams.get('sermon_id') || '';
  if (!UUID_RE.test(sermonId)) return fail('Pick a message first.');
  try {
    const { data, error } = await adminDb()
      .from('declarations')
      .select('id, declaration_text, timestamp_seconds, topic_tags, youtube_url_with_timestamp, created_at')
      .eq('sermon_id', sermonId)
      .order('timestamp_seconds', { ascending: true })
      .limit(500);
    if (error) throw error;
    return ok({ declarations: data || [] });
  } catch (e) {
    return failFrom(e, "Couldn't load the declarations.");
  }
}
