// lib/admin-youtube.js
//
// YouTube Data API calls for the admin console (metadata only; captions are
// fetched by the pipeline on the PC, where YouTube doesn't block the request).
// Server-only: uses YOUTUBE_API_KEY.

const API = 'https://www.googleapis.com/youtube/v3';
const CHANNEL_ID = 'UCV2xi_w10k6ewdPVxDP6uCQ'; // Heritage of Faith; same id as the pipeline
export const MIN_SERMON_SECONDS = 20 * 60;       // the channel's promo clips all run under 5 minutes

const key = () => {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error('YOUTUBE_API_KEY is not set.');
  return k;
};

/**
 * Every YouTube video id found in pasted text: watch?v=, youtu.be/, /live/,
 * /shorts/, /embed/ links, or a bare 11-character id on its own line.
 * Order kept, duplicates dropped.
 */
export function extractVideoIds(text) {
  const out = [];
  const seen = new Set();
  const push = (id) => {
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };
  const tokens = String(text || '').split(/[\s,]+/).filter(Boolean);
  for (const raw of tokens) {
    const t = raw.trim().replace(/^<|>$/g, '');
    if (/^[A-Za-z0-9_-]{11}$/.test(t)) {
      push(t);
      continue;
    }
    try {
      const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
      const host = u.hostname.replace(/^www\.|^m\./, '');
      if (host === 'youtu.be') push(u.pathname.slice(1, 12));
      else if (host.endsWith('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) push(v);
        else {
          const m = u.pathname.match(/^\/(?:live|shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
          if (m) push(m[1]);
        }
      }
    } catch {
      /* not a link */
    }
  }
  return out;
}

// ISO-8601 "PT1H2M3S" -> seconds.
function seconds(d) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

/** Title, date, length, channel and live state for up to 50 ids per call. */
export async function videoDetails(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const url = new URL(`${API}/videos`);
    url.search = new URLSearchParams({
      key: key(),
      id: ids.slice(i, i + 50).join(','),
      part: 'snippet,contentDetails,liveStreamingDetails',
    }).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`YouTube answered ${res.status}.`);
    const data = await res.json();
    for (const item of data.items || []) {
      out.set(item.id, {
        youtube_video_id: item.id,
        title: item.snippet?.title || '',
        published_at: item.snippet?.publishedAt || null,
        channel_id: item.snippet?.channelId || null,
        channel_title: item.snippet?.channelTitle || '',
        duration_seconds: seconds(item.contentDetails?.duration),
        live: item.snippet?.liveBroadcastContent && item.snippet.liveBroadcastContent !== 'none',
        own_channel: item.snippet?.channelId === CHANNEL_ID,
      });
    }
  }
  return out;
}

/** The newest uploads on the church channel (uploads playlist, newest first). */
export async function recentUploads(pages = 4) {
  const playlistId = 'UU' + CHANNEL_ID.slice(2);
  const out = [];
  let pageToken;
  for (let i = 0; i < pages; i++) {
    const url = new URL(`${API}/playlistItems`);
    const params = { key: key(), playlistId, part: 'snippet,contentDetails', maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;
    url.search = new URLSearchParams(params).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`YouTube answered ${res.status}.`);
    const data = await res.json();
    for (const item of data.items || []) {
      const title = item.snippet?.title || '';
      if (title === 'Private video' || title === 'Deleted video') continue;
      out.push({
        youtube_video_id: item.contentDetails?.videoId,
        title,
        published_at: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null,
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** oEmbed check (no key, no quota), same verdicts as check-video-status.js. */
export async function embedStatus(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { cache: 'no-store' }
    );
    if (res.ok) return 'ok';
    if (res.status === 401 || res.status === 403) return 'private';
    if (res.status === 400 || res.status === 404) return 'deleted';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
