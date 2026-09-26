import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { failFrom, ok } from '@/lib/admin-api';
import { isMissingSetup } from '@/lib/admin-dashboard';

export const dynamic = 'force-dynamic';

const PAGE = 40;

/** GET ?before=<id> -> the change history, newest first, 40 at a time. */
export async function GET(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  try {
    const before = Number(new URL(req.url).searchParams.get('before')) || null;
    let q = adminDb().from('admin_audit').select('*').order('id', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('id', before);
    const { data, error } = await q;
    if (isMissingSetup(error)) return ok({ entries: [], setup: true });
    if (error) throw error;
    return ok({ entries: data || [], more: (data || []).length === PAGE });
  } catch (e) {
    return failFrom(e, "Couldn't load the history.");
  }
}
