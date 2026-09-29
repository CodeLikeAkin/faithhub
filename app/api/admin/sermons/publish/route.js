import { adminApiGuard } from '@/lib/admin-auth';
import { UUID_RE, fail, failFrom, ok, readJson } from '@/lib/admin-api';
import { MAX_BULK, setPublished } from '@/lib/admin-sermons';

export const dynamic = 'force-dynamic';

/** POST { ids: [uuid], published: true|false } -> publish or hide several messages at once. */
export async function POST(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  let published;
  try {
    const body = await readJson(req);
    const { ids } = body;
    published = body.published;
    if (typeof published !== 'boolean') return fail('Bad request.');
    if (!Array.isArray(ids) || !ids.length) return fail('Pick at least one message.');
    if (ids.length > MAX_BULK) return fail(`Do up to ${MAX_BULK} at a time.`);
    if (ids.some((id) => !UUID_RE.test(String(id)))) return fail('One of those messages is not valid.');

    const { changed, series } = await setPublished([...new Set(ids)], published);
    return ok({ changed: changed.map((c) => c.id), summaries_cleared: series });
  } catch (e) {
    return failFrom(e, published === false ? "Couldn't hide those messages." : "Couldn't publish those messages.");
  }
}
