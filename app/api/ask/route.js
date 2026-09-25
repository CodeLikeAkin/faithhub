// app/api/ask/route.js
//
// "Ask the Word" — global, cross-corpus search. Same retrieval spine as
// series-chat (hybrid RRF search → diversity rerank → grounded, cited answer),
// but UN-scoped: it searches every embedded sermon in the library at once
// instead of a single series. The frontend renders the streamed answer plus a
// numbered "sources" rail built from SEGMENT_MAP.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { voicePromptSection } from '@/lib/voice';
import { planAskSearch } from '@/lib/groq';
import { detectSpeaker, isMultiVoice } from '@/lib/speakers';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Max characters accepted for a user question. Generous for a real study
// question, but slams the door on oversized bodies before any paid LLM /
// embed / DB work happens. See the guard in POST().
const MAX_MESSAGE_LENGTH = 2000;

// Max scripture references listed per sermon. The prompt only cites a verse
// when one clearly fits the point being made, so a sermon's long tail of
// references (p90 is 52) costs input tokens without improving the answer.
// Rows are ordered by order_index, so this keeps the earliest-opened ones.
const MAX_SCRIPTURES_PER_SERMON = 12;

// Fewest teaching segments worth answering from before service housekeeping
// is allowed to fill the remaining slots (see isServiceNoise).
const MIN_TEACHING_SEGMENTS = 8;

// Not everything spoken into the microphone is teaching. sermon_segments also
// holds service housekeeping — meeting times, transport, when to break a fast
// — and stretches of praying in tongues that the transcript renders as
// nonsense words. Both match keyword search perfectly well: a measured
// "praying and fasting in the morning" search came back with break-fast
// times, bus-stop announcements and three segments of tongues among its 18.
//
// These are DE-PRIORITISED, not dropped. A notice often runs straight back
// into preaching inside the same segment, and a question genuinely about
// service times deserves an answer — so they only fill slots the teaching
// left empty (MIN_TEACHING_SEGMENTS), and the prompt is told not to build on
// them.
const TONGUES_MARKER_RE = /\bforeign (?:speech|language)\b|\binaudible\b/i;
// A word repeated three times running, space-separated ("diva diva diva") —
// how the transcriber renders tongues. Rev. Peter's own repetition for
// emphasis is punctuated ("Read, read, read"), so it doesn't match, and
// worship words that genuinely repeat are excused outright.
const REPEAT_RE = /\b([a-z]{3,})\s+\1\s+\1\b/i;
const REPEATABLE_WORSHIP =
  /^(?:holy|hallelujah|halleluyah|alleluia|glory|amen|jesus|lord|god|yes|praise|thank|more|fire|come|now)$/i;
const LOGISTICS_RES = [
  /\b(?:bus stop|transportation|information (?:center|centre)|car ?park|ushers?)\b/i,
  /\b(?:first|second|third) service\b/i,
  /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m|p\.?m)\b/i,
  /\bbreak (?:your|the) fast\b/i,
  /\b(?:offering|tithe|seed) (?:envelope|basket|bag|time|point)\b/i,
  /\b(?:next week|tomorrow (?:morning|evening)|register|sign up|visit the)\b/i,
];

function isServiceNoise(text) {
  const t = text || '';
  if (TONGUES_MARKER_RE.test(t)) return true;
  const repeat = t.match(REPEAT_RE);
  if (repeat && !REPEATABLE_WORSHIP.test(repeat[1])) return true;
  return LOGISTICS_RES.filter((re) => re.test(t)).length >= 2;
}

// Who is actually speaking in a segment, for the prompt. The library is not
// one voice: Pastor Funlola Alabi preaches ~90 of the messages, guest
// ministers appear, and celebration/panel videos are wall-to-wall church
// members. The prompt used to call all of it "Rev. Peter's teaching", so a
// member's birthday tribute came back as something Rev. Peter himself said.
function speakerLabel(title) {
  if (isMultiVoice(title)) {
    return 'UNKNOWN — a celebration/panel video where several people speak in turn; this could be Rev. Peter himself or a church member, and there is no way to tell which';
  }
  const { name, isGuest } = detectSpeaker(title);
  if (!name || name === 'Rev. Peter Alabi') return 'Rev. Peter Alabi';
  return name + (isGuest ? ' (guest minister)' : '') + ' — NOT Rev. Peter';
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || ''
);

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('WARNING: SUPABASE_SERVICE_KEY not set. RPC calls may fail.');
}

// Diversity-aware rerank over the fused candidate pool. For a cross-corpus
// answer we want breadth — cap how many segments any single sermon contributes
// so the answer draws on multiple messages, then backfill if we come up short.
function rerankSegments(rows, limit = 18, maxPerSermon = 3) {
  const norm = (t) =>
    (t || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

  const seenText = new Set();
  const pickedIds = new Set();
  const perSermon = new Map();
  const out = [];

  for (const r of rows) {
    if (out.length >= limit) break;
    const key = norm(r.text);
    if (seenText.has(key)) continue;
    const count = perSermon.get(r.sermon_id) || 0;
    if (count >= maxPerSermon) continue;
    seenText.add(key);
    perSermon.set(r.sermon_id, count + 1);
    pickedIds.add(r.id);
    out.push(r);
  }

  if (out.length < limit) {
    for (const r of rows) {
      if (out.length >= limit) break;
      if (pickedIds.has(r.id)) continue;
      const key = norm(r.text);
      if (seenText.has(key)) continue;
      seenText.add(key);
      pickedIds.add(r.id);
      out.push(r);
    }
  }

  return out;
}

async function embedText(text) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) throw new Error(`Embed failed: ${await res.text()}`);
  const { embedding } = await res.json();
  return embedding;
}

function plainStreamResponse(text) {
  const encoder = new TextEncoder();
  const body = `SEGMENT_MAP:{}\n${text}`;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

// A genuine, transient failure (service down/overloaded) — as opposed to an
// honest "nothing relevant found" answer. Returned as a real non-200 error so
// the frontend can tell the two apart and offer a "Try again" retry, instead
// of a 200 stream that renders identically to a normal grounded refusal.
function serviceErrorResponse(message) {
  return NextResponse.json({ error: true, message }, { status: 503 });
}

// Gemini answers "high demand" with a 503 often enough that a single attempt
// loses real questions. Retry HERE rather than only in the browser: by this
// point the segments are already retrieved, so an attempt costs one Gemini
// call instead of re-running the embed + hybrid search (~8s) from scratch.
const GEMINI_ATTEMPTS = 3;
const transientProviderError = (msg) => /\b(429|500|502|503|504)\b/.test(msg || '');

async function sendWithRetry(send) {
  let lastErr;
  for (let attempt = 0; attempt < GEMINI_ATTEMPTS; attempt++) {
    try {
      return await send();
    } catch (err) {
      lastErr = err;
      if (!transientProviderError(err.message) || attempt === GEMINI_ATTEMPTS - 1) break;
      // Backoff with jitter — retrying instantly just hits the same busy pool.
      await new Promise((r) => setTimeout(r, 700 * 2 ** attempt + Math.random() * 400));
    }
  }
  throw lastErr;
}

export async function POST(req) {
  const rl = await rateLimit(req, { max: 8, windowMs: 60_000, prefix: 'ask' });
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: true, message: 'Message is required' }, { status: 400 });
    }

    // Cap input length BEFORE spending anything on it. Without this, an
    // oversized body flows straight into the embed function, the FTS query,
    // and the Gemini prompt (paid per token) — a direct cost/abuse vector.
    // 2000 chars is generous for a real study question (~300+ words).
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: true, message: 'Please shorten your question and try again.' },
        { status: 400 }
      );
    }

    // 1. Work out what to actually search for. The question as typed is a
    //    poor query: gte-small weighs every word, so the words people wrap a
    //    question in end up steering it. Measured on this corpus, "areas
    //    where Dad spoke about reading the Bible" returned birthday tributes
    //    and messages on fatherhood — "Dad" (which is what the church calls
    //    Rev. Peter) outweighed the subject, and 1 of 18 segments was about
    //    reading the Bible. "I can't remember which sermon it was but he
    //    talked about..." dropped the right sermon out of the pool entirely,
    //    while the same sentence without the preamble put it at #2.
    //
    //    The plan also says whether they want to be TAUGHT the subject or to
    //    LOCATE where it is — two different answers (see RESPONSE SHAPE).
    //    Groq is a helper here, never the answer: if it fails we search the
    //    raw question exactly as before.
    const plan = await planAskSearch(message);
    const searchText = plan?.search || message;
    const mode = plan?.mode || 'teaching';
    if (plan) console.log(`[ask] "${message.slice(0, 60)}" → [${mode}] "${searchText}"`);

    // 2. Embed it (keyword-only fallback if the embed service is down)
    let queryEmbedding = null;
    try {
      queryEmbedding = await embedText(searchText);
    } catch (embedErr) {
      console.error('[ask] Embed failed:', embedErr.message);
    }
    const embedFailed = !queryEmbedding;

    // 3. Hybrid search across the ENTIRE library. filter_sermon_ids is
    //    omitted (null) — this is a global search by definition, and a filter
    //    listing every sermon in the corpus wouldn't exclude anything, so we
    //    let the RPC skip that clause entirely (see hybrid_search.sql).
    let relevantSegments = [];
    let candidatePool = null;

    const { data: hybrid, error: hybridErr } = await supabaseAdmin.rpc('match_segments_hybrid', {
      query_embedding: queryEmbedding, // may be null → keyword-only
      query_text: searchText,
      match_count: 60,
    });

    if (hybridErr) {
      console.error('[ask] Hybrid RPC error, falling back to vector-only:', hybridErr.message);
      if (queryEmbedding) {
        const { data: vec, error: vecErr } = await supabaseAdmin.rpc('match_segments_by_sermons', {
          query_embedding: queryEmbedding,
          match_threshold: 0.25,
          match_count: 60,
        });
        if (vecErr) console.error('[ask] Vector fallback RPC error:', vecErr.message);
        else candidatePool = vec;
      }
    } else {
      candidatePool = hybrid;
    }

    // `similarity` from match_segments_hybrid is an RRF positional score
    // (1/(rrf_k+rank)) — every query gets a nonzero "rank 1", including
    // gibberish, so it can't tell us whether anything is actually relevant.
    // `vec_similarity` (added by hybrid_search.sql) is real cosine similarity
    // from the semantic leg; 0 means the row only matched via full-text
    // keyword search (a genuine token match, always trusted — e.g. an exact
    // scripture reference).
    //
    // CALIBRATION NOTE: gte-small's cosine similarities are anisotropic for
    // this corpus — everything sits in a compressed high band regardless of
    // topical relevance. Measured on-topic queries scored 0.863–0.912;
    // measured off-topic/gibberish queries scored 0.765–0.857. The gap is
    // razor-thin (~0.006) and not safe to use as a hard reject line — a
    // precise cutoff there is overfit to a handful of samples and risks
    // wrongly rejecting real, sparsely-worded questions. So this floor is
    // deliberately conservative: it only drops the clearest noise (bare
    // keyboard-mash, wholly unrelated general trivia), not edge cases like
    // "cryptocurrency investing" — those are left to the prompt, which
    // already handles them correctly (see WEAK GROUNDING instruction below
    // and the 20-question case study). Rows from the vector-only fallback
    // RPC are already thresholded server-side and have no vec_similarity
    // field, so they pass through untouched.
    const MIN_VEC_SIMILARITY = 0.8;
    // Separate, higher bar used only to flag weak grounding to the prompt
    // (never to filter) — roughly the floor of the on-topic calibration band.
    const CONFIDENT_VEC_SIMILARITY = 0.86;
    let weakGrounding = false;
    if (Array.isArray(candidatePool) && candidatePool.length > 0) {
      const grounded = candidatePool.filter((r) => {
        if (r.vec_similarity === undefined) return true; // vector-only fallback, already thresholded
        return r.vec_similarity === 0 || r.vec_similarity >= MIN_VEC_SIMILARITY;
      });
      // Teaching first: service housekeeping and tongues only backfill an
      // otherwise thin answer, instead of crowding real teaching out of the
      // 18 slots. (Celebration and panel videos are NOT held back — Rev.
      // Peter preaches in those too. Who is speaking is handled by the
      // SPEAKER line on each segment, not by dropping them.) A locate
      // question wants breadth of MESSAGES rather than depth in any one, so
      // it takes fewer segments per sermon.
      const maxPerSermon = mode === 'locate' ? 2 : 3;
      const sidelined = (r) => isServiceNoise(r.text);
      relevantSegments = rerankSegments(grounded.filter((r) => !sidelined(r)), 18, maxPerSermon);
      if (relevantSegments.length < MIN_TEACHING_SEGMENTS) {
        const picked = new Set(relevantSegments.map((r) => r.id));
        relevantSegments = relevantSegments.concat(
          rerankSegments(
            grounded.filter((r) => sidelined(r) && !picked.has(r.id)),
            18 - relevantSegments.length,
            maxPerSermon
          )
        );
      }
      weakGrounding =
        relevantSegments.length > 0 &&
        !relevantSegments.some(
          (r) =>
            r.vec_similarity === undefined ||
            r.vec_similarity === 0 ||
            r.vec_similarity >= CONFIDENT_VEC_SIMILARITY
        );
    }

    // 4. Nothing grounded → be honest, never fabricate.
    if (relevantSegments.length === 0) {
      console.warn(`[ask] No grounded segments (embedFailed=${embedFailed}). Refusing to fabricate.`);
      // embedFailed means the embed service itself is down — a real, transient
      // failure worth retrying. A clean zero-match search is not a failure at
      // all (retrying the same question won't change the answer), so that one
      // stays a normal streamed "done" response.
      if (embedFailed) {
        return serviceErrorResponse(
          "I'm having trouble reaching the study service right now, so I can't search Rev. Peter's messages for this yet. Please try again in a moment."
        );
      }
      return plainStreamResponse(
        "I couldn't find where Rev. Peter teaches on that across the messages I have indexed. Try rephrasing, or ask about a related idea — faith, prayer, righteousness, the Holy Spirit, giving, and more are all covered deeply."
      );
    }

    // 4b. Real scripture references for the sermons behind these segments, so
    // Gemini can cite verses it actually knows exist instead of guessing.
    // `theme` is included as a disambiguating hint when a sermon opened several
    // verses and only one fits a given segment.
    //
    // A sermon can open 40+ verses, far more than any one answer needs, so each
    // sermon's list is trimmed to MAX_SCRIPTURES_PER_SERMON. The trim keeps the
    // verses opened CLOSEST IN TIME to the segments actually retrieved from that
    // sermon (97% of rows carry timestamp_seconds), not the first N in preaching
    // order — a segment from minute 50 of a long message needs the verses from
    // around minute 50, and an order_index trim would hand it the opening ones.
    // Rows with no timestamp fall back to preaching order, ranked last.
    const sermonIds = [...new Set(relevantSegments.map((s) => s.sermon_id))];
    const scripturesBySermon = new Map();
    if (sermonIds.length) {
      const { data: scriptureRows, error: scriptureErr } = await supabaseAdmin
        .from('sermon_scriptures')
        .select('sermon_id, reference, theme, order_index, timestamp_seconds')
        .in('sermon_id', sermonIds)
        .order('order_index', { ascending: true });
      if (scriptureErr) {
        console.error('[ask] sermon_scriptures fetch error:', scriptureErr.message);
      } else if (scriptureRows) {
        // When did we actually retrieve from each sermon?
        const segmentTimesBySermon = new Map();
        for (const seg of relevantSegments) {
          if (typeof seg.start_seconds !== 'number') continue;
          if (!segmentTimesBySermon.has(seg.sermon_id)) segmentTimesBySermon.set(seg.sermon_id, []);
          segmentTimesBySermon.get(seg.sermon_id).push(seg.start_seconds);
        }

        const rowsBySermon = new Map();
        for (const row of scriptureRows) {
          if (!rowsBySermon.has(row.sermon_id)) rowsBySermon.set(row.sermon_id, []);
          rowsBySermon.get(row.sermon_id).push(row);
        }

        for (const [sermonId, rows] of rowsBySermon) {
          const times = segmentTimesBySermon.get(sermonId) || [];
          const distance = (row) => {
            if (typeof row.timestamp_seconds !== 'number' || !times.length) return Infinity;
            return Math.min(...times.map((t) => Math.abs(t - row.timestamp_seconds)));
          };
          const kept = rows
            .map((row, i) => ({ row, i, d: distance(row) }))
            // nearest first; ties and untimestamped rows keep preaching order
            .sort((a, b) => (a.d - b.d) || (a.i - b.i))
            .slice(0, MAX_SCRIPTURES_PER_SERMON)
            // present them back in preaching order so the list reads naturally
            .sort((a, b) => a.i - b.i)
            .map(({ row }) => (row.theme ? `${row.reference} (${row.theme})` : row.reference));
          scripturesBySermon.set(sermonId, kept);
        }
      }
    }

    // 5. Build the numbered segment list + the map the frontend renders as sources.
    //
    // Scriptures are listed ONCE per message, in their own block, rather than
    // re-pasted onto every segment. The 18 segments typically come from only
    // ~8 distinct sermons, so the old per-segment refLine repeated a sermon's
    // entire reference list (avg 1,266 chars) once per segment it contributed —
    // measured at ~11k duplicated characters, about 20% of the whole prompt.
    // Each segment now carries an (M#) key pointing into that block instead.
    const messageKeyBySermon = new Map();
    sermonIds.forEach((id, i) => messageKeyBySermon.set(id, `M${i + 1}`));

    const titleBySermon = new Map(
      relevantSegments.map((seg) => [seg.sermon_id, seg.sermon_title])
    );

    const scriptureBlock = [...scripturesBySermon.entries()]
      .filter(([, refs]) => refs.length)
      .map(
        ([sermonId, refs]) =>
          `(${messageKeyBySermon.get(sermonId)}) ${titleBySermon.get(sermonId) || ''}\n${refs.join(', ')}`
      )
      .join('\n\n');

    // Who said it, on every line. ~90 of the messages in this library are
    // Pastor Funlola Alabi's, guest ministers appear, and celebration videos
    // are church members one after another — all of it used to be handed over
    // as "Rev. Peter's teaching".
    const speakerBySermon = new Map(
      relevantSegments.map((seg) => [seg.sermon_id, speakerLabel(seg.sermon_title)])
    );

    const segmentList = relevantSegments
      .map(
        (seg, i) =>
          `[${i + 1}] (${messageKeyBySermon.get(seg.sermon_id)}) SERMON:${seg.sermon_title}\nSPEAKER:${speakerBySermon.get(seg.sermon_id)}\n"${seg.text}"`
      )
      .join('\n\n');

    const snippet = (t) =>
      (t || '').length > 300 ? `${t.slice(0, 300).trim()}…` : t || '';

    const segmentMap = relevantSegments.reduce((acc, seg, i) => {
      const { name } = detectSpeaker(seg.sermon_title);
      acc[i + 1] = {
        sermon_id: seg.sermon_id,
        video_id: seg.video_id,
        start_seconds: seg.start_seconds,
        sermon_title: seg.sermon_title,
        // Only when it ISN'T Rev. Peter — the cards say so under the title.
        // null for his own messages keeps the streamed header small.
        speaker: isMultiVoice(seg.sermon_title)
          ? 'Various speakers'
          : name && name !== 'Rev. Peter Alabi'
            ? name
            : null,
        text: snippet(seg.text),
      };
      return acc;
    }, {});

    // 6. System prompt — tuned for synthesis ACROSS messages.
    //
    // Two different questions hide behind one box. "What does he teach about
    // faith?" wants a lesson. "Which message was that in?" and "where are the
    // places he covers X?" want to be pointed at the messages — answering
    // those with a woven essay buries the one thing that was asked for.
    // planAskSearch tells them apart.
    const TEACHING_SHAPE = `═══════════════════════════════════════
RESPONSE SHAPE
═══════════════════════════════════════
- Open with a direct, one-sentence answer to the question.
- Then paragraphs of flowing prose that develop it, drawing threads from the different messages.
- EXCEPTION — if one or more of the segments has Rev. Peter enumerating points himself
  (e.g. "number one... number two...", "the first thing is... secondly..."), preserve
  that structure as a numbered list in his order, each item citing its segment(s),
  rather than flattening it into prose.
- Prefer Rev. Peter's own phrasing — quote his exact words when they're memorable.
- Develop each point you make — name it, then explain or quote what he actually said
  about it, rather than compressing it to a single clause before moving on.
- Refer to him as "Rev. Peter". Warm, faith-filled, never academic or robotic.
- Never say "the transcript says" or "according to the segment" — teach it as living truth.
- Don't pad with content that isn't in the segments — but don't under-write what is.`;

    const LOCATE_SHAPE = `═══════════════════════════════════════
RESPONSE SHAPE — THEY ARE LOOKING FOR THE MESSAGES
═══════════════════════════════════════
- They want to know WHERE this is in the library, not to be taught it. Point them at the messages.
- Open with one sentence naming the best match — the message, and what is said there — with its [N].
- Then a short list, one item per message: name the message, then in a sentence or two what is
  said there, in his own words where they are memorable, citing its [N]. Merge segments from the
  same message into one item; never split one message across two items.
- Order by how well each message actually matches, best first. Three to six messages is plenty —
  leave out the ones that only brush the subject.
- Name each message by its SERMON: line, and attach the [N] of a segment that actually came from
  THAT message. A title from one message with another message's number is the one mistake this
  answer cannot survive — the reader taps it and lands somewhere else.
- Don't build a teaching out of them, don't add background, and keep the whole answer under
  about 250 words. They are going to tap through and watch.
- You do not know where in a video each moment falls — never guess a timestamp or say "early on".
  The citation itself takes them to the exact moment.
- If nothing clearly matches, say that plainly first, then mention at most the closest thing.
- Refer to him as "Rev. Peter". Warm and direct, never academic.
- Never say "the transcript says" or "according to the segment".`;

    const systemPrompt = `You are a warm, discerning Bible study companion for Heritage of Faith Church. A believer has asked one question, and you are answering it from across the church's messages — many at once. Most are Rev. Peter Ayoalabi's; some are not, so read the SPEAKER line on every segment.

═══════════════════════════════════════
SOURCING — YOUR MOST CRITICAL RULE
═══════════════════════════════════════
- You may ONLY use what is explicitly stated in the transcript segments provided below.
${mode === 'locate'
  ? '- The segments come from DIFFERENT sermons. Keep them apart: the point of this answer is which message each thing is in, so never merge two messages into one claim.'
  : '- The segments come from DIFFERENT sermons. Weave them into ONE coherent answer.'}
- Never add outside theology, generic Christian advice, or anything from your training data.
- If the segments only partially cover the question, answer what they do cover and say plainly what isn't addressed.
- Never invent or assume what Rev. Peter might teach.

═══════════════════════════════════════
WHO IS SPEAKING — NEVER GET THIS WRONG
═══════════════════════════════════════
- Every segment carries a SPEAKER line, and it is not always Rev. Peter. His wife Pastor Funlola Alabi preaches many of these messages, guest ministers preach some, and in celebration or panel videos ordinary church members take the microphone one after another.
- Say "Rev. Peter" ONLY for segments whose SPEAKER is Rev. Peter Alabi. Name the others as they are given ("Pastor Funlola Alabi teaches...", "a guest minister, Pastor X, said..."). Never put another person's words in Rev. Peter's mouth — not even to make the answer flow.
- A segment marked SPEAKER:UNKNOWN comes from a video where several people speak in turn — a tribute, a testimony, a panel. It may be Rev. Peter and it may be a church member talking ABOUT him (they call him "Dad" too), and nothing tells you which. Attribute it to the MESSAGE, never to a person: "in ICONIC, someone recalls…", not "Rev. Peter said…" and not "a church member said…". Never present it as his teaching.
- If the question asks what REV. PETER teaches and the segments are mostly other speakers, say so rather than blurring the two.
- Some segments are not teaching at all: service housekeeping (meeting times, transport, when to break a fast, what is happening next week) or praying in tongues, which the transcript renders as repeated nonsense words. Never build a point on those and don't cite them.

═══════════════════════════════════════
CITATION RULES — MANDATORY
═══════════════════════════════════════
- Every factual claim MUST end with [N] matching a segment number.
- When a point is echoed across multiple messages, cite each relevant one, e.g. "...faith comes by hearing [2][7]."
- Only cite segments you actually used. Citations are inline only — no CITATIONS section, no URLs.

═══════════════════════════════════════
SCRIPTURE CITATION — WHEN AVAILABLE
═══════════════════════════════════════
- A "SCRIPTURES OPENED IN EACH MESSAGE" block may appear above the segments. Each entry is keyed (M1), (M2)… and lists the real verses Rev. Peter cited in that message, sometimes with a short theme label. Every segment is tagged with the same (M#) key, so a segment's own verses are the ones under its matching key.
- When a point you're making is clearly what one of those listed verses is about, name the reference inline right where the point is made, e.g. "...righteousness is God's gift by faith (Romans 3:21–26) [3]."
- Only ever cite a reference listed under that segment's own (M#) key. Never infer, guess, or add a verse that isn't listed for that message — if a point has no listed verse that clearly fits, just use the [N] citation as usual, no verse.
- Don't force a verse onto every sentence — cite the way a preacher naturally references scripture while teaching, not a footnote on every line.
${weakGrounding ? `
═══════════════════════════════════════
WEAK GROUNDING — THIS QUESTION
═══════════════════════════════════════
- None of the segments below are a confident, on-topic match for this question — they're the closest the search found, but the connection is loose.
- Say plainly, in one or two sentences, that Rev. Peter's messages don't clearly address this. Do this FIRST, before anything else.
- Do not pad the answer with paragraphs stitched from these loosely-related segments just to seem thorough. If one segment is genuinely worth a short mention after the disclaimer, fine — otherwise stop there.
` : ''}
${mode === 'locate' ? LOCATE_SHAPE : TEACHING_SHAPE}

═══════════════════════════════════════
FOLLOW-UP SUGGESTIONS — STRICT
═══════════════════════════════════════
- End with EXACTLY: SUGGESTIONS:["Suggestion one","Suggestion two","Suggestion three"]
- Each suggestion MUST be answerable from the segments you were given — specific, not generic.
- Each suggestion is a short tappable phrase or simple question, 4-8 words, ONE idea only — never a compound sentence, never multiple clauses joined by "and"/"or". These are tap targets, not essay prompts.${voicePromptSection()}`;

    const scriptureSection = scriptureBlock
      ? `SCRIPTURES OPENED IN EACH MESSAGE — each block is keyed (M#) to the segments below:
${scriptureBlock}

`
      : '';

    const userMessageWithContext = `${scriptureSection}TRANSCRIPT SEGMENTS FROM ACROSS REV. PETER'S MESSAGES — USE ONLY THESE:
${segmentList}

QUESTION: ${message}`;

    // Prompt size is the main driver of per-question cost (input tokens are
    // ~95% of the bill on this workload), so log it alongside the segment count.
    const promptChars = systemPrompt.length + userMessageWithContext.length;
    console.log(
      `[ask] ${relevantSegments.length} segments (from ${new Set(relevantSegments.map(s => s.sermon_id)).size} sermons), ` +
      `~${Math.round(promptChars / 3.8).toLocaleString()} input tokens (${promptChars.toLocaleString()} chars) sent to Gemini`
    );

    // 7. Stream the answer, SEGMENT_MAP header first (same wire format as chat).
    const model = genAI.getGenerativeModel({
      // Pinned, NOT the "-latest" alias. At this route's real prompt size
      // (~10k tokens, streamed) that alias 503s roughly three times in four —
      // it tracks whatever Google has just shipped, and that pool is saturated.
      // This model answers 4/4 in ~2s. Re-measure before changing it.
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    // Gemini can reject here (429 quota, 503 overload) before any streaming
    // starts — that's exactly what we saw during testing. Without this catch,
    // the raw provider error (with quota/billing details) leaks to the user
    // as a 500 body. Answer honestly instead, same tone as the no-segments case.
    let result;
    try {
      result = await sendWithRetry(() => model.generateContentStream(userMessageWithContext));
    } catch (genErr) {
      console.error(`[ask] Gemini generateContentStream failed after ${GEMINI_ATTEMPTS} attempts:`, genErr.message);
      return serviceErrorResponse(
        "The study service is busier than usual right now — please try that question again in a moment."
      );
    }

    const encoder = new TextEncoder();
    const segmentMapHeader = `SEGMENT_MAP:${JSON.stringify(segmentMap)}\n`;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(segmentMapHeader));
          for await (const chunk of result.stream) {
            const content = chunk.text();
            if (content) controller.enqueue(encoder.encode(content));
          }
          // close() only on the success path — closing an errored controller
          // throws "Invalid state" and buries the original failure.
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[ask] Error:', error);
    return NextResponse.json(
      { error: true, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
