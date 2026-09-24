import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { fail, failFrom, ok, readJson } from '@/lib/admin-api';
import { MIN_SERMON_SECONDS, extractVideoIds, videoDetails } from '@/lib/admin-youtube';
import { closeMatchSeries, matchSeries, parsePartNumber } from '@/lib/admin-series';
import { detectSpeaker } from '@/lib/speakers';

export const dynamic = 'force-dynamic';

const MAX_LINKS = 25;

async function allRows(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/**
 * POST { text } -> what each pasted link is, whether it's already in the
 * library or queued, and the series it would join (pipeline stage 2's rule),
 * with the part number the church wrote in the title, or the next free one.
 */
export async function POST(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  try {
    const { text } = await readJson(req);
    const ids = extractVideoIds(text);
    if (!ids.length) return fail("No YouTube links found. Paste links like https://youtu.be/... or https://www.youtube.com/watch?v=...");
    if (ids.length > MAX_LINKS) return fail(`That's ${ids.length} links. Add up to ${MAX_LINKS} at a time.`);

    const db = adminDb();
    const [details, seriesList, links, inLibrary, activeJobs] = await Promise.all([
      videoDetails(ids),
      allRows(() => db.from('series').select('id, title, total_parts').order('title')),
      allRows(() => db.from('series_sermons').select('series_id, sermon_id, part_number')),
      db.from('sermons').select('id, title, youtube_video_id').in('youtube_video_id', ids),
      db.from('admin_jobs').select('youtube_video_id, status').in('youtube_video_id', ids).in('status', ['queued', 'running']),
    ]);
    if (inLibrary.error) throw inLibrary.error;

    const maxPart = new Map();
    const linkOf = new Map();
    for (const l of links) {
      maxPart.set(l.series_id, Math.max(maxPart.get(l.series_id) || 0, l.part_number || 0));
      linkOf.set(l.sermon_id, l);
    }
    const seriesById = new Map(seriesList.map((s) => [s.id, s]));
    const libraryByVideo = new Map((inLibrary.data || []).map((s) => [s.youtube_video_id, s]));
    const jobByVideo = new Map((activeJobs.data || []).map((j) => [j.youtube_video_id, j.status]));

    const items = ids.map((id) => {
      const d = details.get(id);
      if (!d) return { youtube_video_id: id, found: false };

      const existing = libraryByVideo.get(id) || null;
      const existingLink = existing ? linkOf.get(existing.id) : null;
      const exact = matchSeries(d.title, seriesList);
      const match = exact || closeMatchSeries(d.title, seriesList);
      const written = parsePartNumber(d.title);
      const suggestion = match
        ? {
            series_id: match.id,
            title: match.title,
            part_number: written || (maxPart.get(match.id) || 0) + 1,
            from_title: !!written,
            close: !exact, // names differ slightly; the page asks the admin to check
          }
        : null;

      return {
        found: true,
        ...d,
        speaker: detectSpeaker(d.title).name,
        short: d.duration_seconds > 0 && d.duration_seconds < MIN_SERMON_SECONDS,
        in_library: existing
          ? {
              sermon_id: existing.id,
              series_title: existingLink ? seriesById.get(existingLink.series_id)?.title || null : null,
              part_number: existingLink?.part_number || null,
            }
          : null,
        job_status: jobByVideo.get(id) || null,
        suggestion,
      };
    });

    return ok({
      items,
      series: seriesList.map((s) => ({ id: s.id, title: s.title, next_part: (maxPart.get(s.id) || 0) + 1 })),
    });
  } catch (e) {
    return failFrom(e, "Couldn't look those links up. Check the YouTube key and try again.");
  }
}
