// app/api/declarations/route.js
// "What are you facing?" — semantic + keyword search over declarations.
// Flow: Groq plans 3 declaration-shaped lines + keywords → embed each line →
//       several match_declarations_hybrid legs, fused (RRF) → Groq reranks the
//       fused pool against the actual sentences → ranked top 10. Falls back to
//       a single hybrid search on the raw message if Groq is unreachable or
//       nothing comes back. The Groq pastoral note runs alongside all of it.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDeclarations, planDeclarationSearch, rerankDeclarations } from "@/lib/groq";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if (!serviceKey) {
  throw new Error('SUPABASE_SERVICE_KEY is required for the declarations API');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey
);

// Max characters accepted for the user's situation text. Bounds it before the
// embed function, the FTS query, and the Groq pastoral reply run on it.
const MAX_MESSAGE_LENGTH = 2000;

// Fewest characters that can describe a need. A stray keystroke ("d") carries
// no need at all, but the planner will still invent three plausible
// declarations from it and the search will dutifully return ten — so it is
// turned away here rather than answered with something that looks considered.
const MIN_MESSAGE_LENGTH = 3;

// ─────────────────────────────────────────────
// Helper: call Supabase Edge Function to embed text
// Uses gte-small (384 dims) — free, no OpenAI needed
// ─────────────────────────────────────────────
async function embedText(text) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed function failed: ${err}`);
  }

  const { embedding } = await res.json();
  return embedding;
}

// ─────────────────────────────────────────────
// Helper: normalize declaration text for de-duplication (lowercase, strip
// punctuation & extra spaces). Two rows can be the same declaration with
// trivial punctuation/casing differences from how they were transcribed.
// ─────────────────────────────────────────────
function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// De-dupes by normalized text, keeping the first (best-ranked) occurrence —
// every list this is called on is already ordered by relevance.
function dedupeByText(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = normalizeText(row.declaration_text);
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}

// One leg of the multi-line search (see planDeclarationSearch in lib/groq.js):
// queryEmbedding + queryText="" is a semantic-only leg on one declaration
// line; queryEmbedding=null + queryText is a keyword-only leg (the plan's
// need-nouns, or the user's own words for exact phrases/scripture refs).
// Never throws — a failed leg just contributes nothing, so the other legs
// (and ultimately the raw-message fallback below) still carry the search.
async function hybridLeg(queryEmbedding, queryText, excludeIds, matchCount = 40) {
  const { data, error } = await supabase.rpc("match_declarations_hybrid", {
    query_embedding: queryEmbedding,
    query_text: queryText,
    match_count: matchCount,
    exclude_ids: excludeIds.length > 0 ? excludeIds : [],
  });
  if (error) {
    console.error("[declarations] Hybrid leg RPC error:", error.message);
    return [];
  }
  return data || [];
}

// Reciprocal Rank Fusion across several leg results into one ranked list —
// one layer up from the RRF match_declarations_hybrid already does between
// its own semantic/keyword legs (see supabase/migrations/hybrid_search.sql).
// Positional, like that RPC's `similarity`: every leg has a "rank 1", so this
// is for ordering candidates, not for judging whether any of them are good.
function fuseRanked(lists, rrfK = 50) {
  const score = new Map();
  const row = new Map();
  for (const list of lists) {
    list.forEach((d, i) => {
      score.set(d.id, (score.get(d.id) || 0) + 1 / (rrfK + i + 1));
      row.set(d.id, d);
    });
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => row.get(id));
}

// ─────────────────────────────────────────────
// Helper: fetch Bible verse from AO Lab API (free, no key)
// e.g. parseScriptureRef("Romans 8:37") → { book: "ROM", chapter: 8, verse: 37 }
// ─────────────────────────────────────────────
async function fetchBibleVerse(ref) {
  try {
    // Simple regex to parse "Book Chapter:Verse"
    const match = ref.match(/^(\d?\s?[A-Za-z]+)\s+(\d+):(\d+)$/);
    if (!match) return null;

    const bookRaw = match[1].trim();
    const chapter = match[2];
    const verse = match[3];

    // AO Lab uses abbreviated book codes — fetch chapter and filter verse
    const url = `https://bible.helloao.org/api/BSB/${encodeURIComponent(bookRaw)}/${chapter}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const verseObj = data?.chapter?.content?.find(
      (v) => v.type === "verse" && String(v.number) === verse
    );

    return verseObj
      ? { reference: ref, text: verseObj.content?.map((c) => c.text).join("") }
      : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const rl = await rateLimit(request, { max: 8, windowMs: 60_000, prefix: 'declarations' });
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const { message, shownIds = [], topics = [] } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // Too short to be a need (see MIN_MESSAGE_LENGTH). Only the freeform path
    // reads `message`; topic-grid browsing sends its chips instead.
    if (topics.length === 0 && message.trim().length < MIN_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: "Tell me a little more about what you're facing — a letter or two isn't enough to search on." },
        { status: 400 }
      );
    }

    // Cap input length before any paid embed / Groq work (see MAX_MESSAGE_LENGTH).
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: "Please shorten what you share and try again." },
        { status: 400 }
      );
    }

    // The pastoral note depends only on the message, so start it now and let it
    // run alongside the rewrite → embed → search chain instead of after it.
    // "Show 10 more" (shownIds present) never displays a note, so it gets none.
    // Whenever the note turns out not to be needed (nothing relevant matched,
    // or an early return below), noteAbort cancels the Groq request instead of
    // paying for a reply nobody sees. The no-op catch stops a cancelled or
    // failed note from becoming an unhandled rejection; a real failure still
    // throws where it's awaited in step 7.
    const wantNote = !(Array.isArray(shownIds) && shownIds.length);
    const noteAbort = new AbortController();
    const replyPromise = wantNote ? getDeclarations(message, { signal: noteAbort.signal }) : Promise.resolve(null);
    replyPromise.catch(() => {});

    let declarations = [];
    let embeddingFailed = false;
    // True when the freeform (non-topic) search found nothing relevant, so any
    // declarations we end up showing come from the table-wide random fallback,
    // not from anything actually matching what the user shared.
    let noRelevantMatch = false;
    // True when the reranker read the candidates and judged that none of them
    // speak to the need — a verdict, unlike an empty search result.
    let judgedIrrelevant = false;

    // ── Topic-grid browsing (Faith/Finances/etc.) is a filter over the fixed
    // topic_tags taxonomy, not freeform retrieval — go straight to the tag
    // column instead of the embed+hybrid path. See CLAUDE.md rule 2.
    // Multiple active chips (e.g. Finances + Fear) stay a single 10-at-a-time
    // page mixed across all of them (tag overlap), not 10 per chip.
    if (topics.length > 0) {
      // Fetch one extra beyond the 10-per-page slice so step 6 below can tell
      // whether more remain in the (already random, already-excluded) tagged pool.
      const { data, error } = await supabase.rpc("match_declarations_by_topic", {
        topics,
        match_count: 11,
        exclude_ids: shownIds.length > 0 ? shownIds : [],
      });
      if (error) {
        console.error("[declarations] Topic RPC error:", error.message);
      } else {
        declarations = data || [];
      }
    } else {
      // ── 1. Plan the search ────────────────────────────────────
      // Three short declaration-shaped lines (plain need, church/Bible
      // phrasing, specific outcome) + the need's own nouns for a keyword leg.
      // See planDeclarationSearch in lib/groq.js for why three lines instead
      // of one rewrite. Fails fast (6s, no retries) so a Groq outage falls
      // through to step 4 instead of hanging the request.
      const plan = await planDeclarationSearch(message);

      let candidates = [];
      if (plan && plan.declarations.length > 0) {
        // ── 2. Multi-leg hybrid search, fused ───────────────────
        const lines = plan.declarations.slice(0, 3);

        const lineEmbeddings = await Promise.all(
          lines.map(async (line) => {
            try {
              return await embedText(line);
            } catch (err) {
              console.error("[declarations] Line embed failed:", err.message);
              return null;
            }
          })
        );
        // Only matters for the fallback-to-random log message below — if some
        // lines embedded fine, their legs still carry the search past this point.
        if (lineEmbeddings.every((e) => e === null)) embeddingFailed = true;

        const legs = await Promise.all([
          ...lineEmbeddings
            .filter((e) => e !== null)
            .map((e) => hybridLeg(e, "", shownIds)),
          // Keyword leg on the plan's need-nouns, plus one on the user's own
          // words — catches exact scripture refs/names the lines paraphrase away.
          plan.keywords.length > 0 ? hybridLeg(null, plan.keywords.join(" or "), shownIds) : Promise.resolve([]),
          hybridLeg(null, message, shownIds),
        ]);

        candidates = dedupeByText(fuseRanked(legs)).slice(0, 60);

        // ── 3. Rerank ────────────────────────────────────────────
        // The fused order is positional, not a relevance judgement (see
        // fuseRanked) — read the actual sentences and keep only the ones that
        // answer the need. The rejects are dropped rather than trailed behind
        // the picks: padding a short list of good matches back up to ten is
        // what put "I have a special slot." under "long life". If Groq itself
        // fails (null, not an empty verdict) the fused order still stands.
        if (candidates.length > 0) {
          const ranked = await rerankDeclarations(message, candidates.map((d) => d.declaration_text));
          if (ranked) {
            candidates = ranked.picks.map((n) => candidates[n - 1]).filter(Boolean);
            // It read every candidate and none fit. Going on to step 4 would
            // only re-run the same search and re-find them, so stop here and
            // let step 5 answer with general declarations, plainly labelled.
            if (candidates.length === 0) judgedIrrelevant = true;
          }
        }
      }

      if (candidates.length > 0) {
        declarations = candidates;
      } else if (!judgedIrrelevant) {
        // ── 4. Fallback: single hybrid search on the raw message ──
        // Groq is unreachable (plan failed) or every leg came back empty —
        // fall back to embedding the message as-is against the library.
        let queryEmbedding;
        try {
          queryEmbedding = await embedText(message);
        } catch (embedErr) {
          console.error("[declarations] Embed failed:", embedErr.message);
          embeddingFailed = true;
          queryEmbedding = null;
        }

        if (queryEmbedding || message.trim()) {
          const { data, error } = await supabase.rpc("match_declarations_hybrid", {
            query_embedding: queryEmbedding, // may be null → keyword-only
            query_text: message,
            match_count: 30,
            exclude_ids: shownIds.length > 0 ? shownIds : [],
          });

          if (error) {
            // Hybrid RPC not applied yet (migration pending) or failed — fall back
            // to the vector-only RPC when we have an embedding.
            console.error("[declarations] Hybrid RPC error, falling back to vector-only:", error.message);
            if (queryEmbedding) {
              const { data: vec, error: vecErr } = await supabase.rpc("match_declarations", {
                query_embedding: queryEmbedding,
                match_threshold: 0.3,
                match_count: 30,
                exclude_ids: shownIds.length > 0 ? shownIds : [],
              });
              if (vecErr) console.error("[declarations] Vector fallback RPC error:", vecErr.message);
              else if (vec && vec.length > 0) declarations = vec;
            }
          } else if (data && data.length > 0) {
            declarations = data;
          }
        }
      }
    }

    // ── 4b. Drop anything already shown, by wording ────────────
    // The library holds the same declaration more than once under different
    // ids (the same line transcribed from two messages). Paging excludes by
    // id, and dedupeByText below only sees one response at a time, so a twin
    // row used to reappear on "Show 10 more". Look up what the earlier pages
    // actually said and exclude that wording too.
    if (shownIds.length > 0 && declarations.length > 0) {
      const { data: seen, error: seenErr } = await supabase
        .from("declarations")
        .select("declaration_text")
        .in("id", shownIds);
      if (seenErr) console.error("[declarations] Shown-text lookup failed:", seenErr.message);
      const shownTexts = new Set((seen || []).map((d) => normalizeText(d.declaration_text)));
      if (shownTexts.size > 0) {
        declarations = declarations.filter((d) => !shownTexts.has(normalizeText(d.declaration_text)));
      }
    }

    // ── 5. Fallback: random declarations if nothing else returned ──
    if (declarations.length === 0) {
      const reason = embeddingFailed
        ? "embedding service unavailable"
        : "semantic search returned no results";
      console.warn(`[declarations] Using fallback (${reason}). User will receive random declarations instead of semantically relevant ones.`);
      // Only the freeform path implies "these match what you said" — the topic
      // grid's fallback above is already tag-filtered, so it stays relevant.
      if (topics.length === 0) noRelevantMatch = true;
      let query = supabase
        .from("declarations")
        .select(`
          id,
          declaration_text,
          youtube_url_with_timestamp,
          topic_tags,
          sermons (title)
        `);

      // Keep the fallback topic-aware: if the topic RPC failed, don't degrade
      // to table-wide random results — stay filtered to what was actually asked for.
      // overlaps() mirrors the RPC's tag && topics — any active chip qualifies.
      if (topics.length > 0) {
        query = query.overlaps("topic_tags", topics);
      }

      if (shownIds.length > 0) {
        // uuid column — no quotes around each id, unlike a text/in filter
        query = query.not("id", "in", `(${shownIds.join(',')})`);
      }

      const { data: fallback, error: fallbackError } = await query.limit(30);
      if (fallbackError) {
        // Previously swallowed — this is what hid the paused-database outage.
        console.error("[declarations] Fallback query failed:", fallbackError.message);
      }

      declarations = (fallback || []).map((d) => ({
        ...d,
        sermon_title: d.sermons?.title || "Heritage of Faith Church",
        similarity: 0,
      }));

      // This query has no ORDER BY, so without a shuffle it would serve the same
      // first 30 rows every time. Fisher-Yates for variety (fallback only; ranked
      // results keep their order, see step 7).
      for (let i = declarations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [declarations[i], declarations[j]] = [declarations[j], declarations[i]];
      }
    }

    // ── 6. Deduplicate by declaration text ────────────────────
    // Candidates from the new plan+rerank path are already deduped (step 2);
    // this catches the fallback paths (single hybrid/vector search, random).
    // Every list here is already ordered by relevance, so first-occurrence
    // and highest-similarity agree — see dedupeByText.
    declarations = dedupeByText(declarations);

    // ── 7. Keep the ranked order ─────────────────────────────
    // No shuffle for RPC results. Shuffling the top 30 and showing 10 of them
    // used to bury the best matches (ranks 1-3) under the tail. The hybrid RPC
    // already orders by relevance (the topic RPC in random order), and "Show 10
    // more" pages down the same list via shownIds.

    // ── 8. Determine hasMore and slice to 10 ─────────────────
    const hasMore = declarations.length > 10;
    const toReturn = declarations.slice(0, 10).map((d) => ({
      id: d.id,
      declaration_text: d.declaration_text,
      sermon_title: d.sermon_title || "Heritage of Faith Church",
      youtube_url_with_timestamp: d.youtube_url_with_timestamp || "",
      topic_tags: d.topic_tags || [],
    }));

    // ── 8b. No declarations at all → data layer is down or empty. ──
    // Do NOT fabricate a pastoral paragraph with nothing behind it (that is what
    // made the paused-database outage look like a working "write-up"). Fail loud.
    if (toReturn.length === 0) {
      noteAbort.abort();
      console.error("[declarations] No declarations available — data layer unreachable or empty. Returning 503 instead of a fabricated response.");
      return NextResponse.json(
        { error: "Declarations library is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }

    // ── 9. Generate pastoral AI response via Groq ────────────
    // If nothing actually matched what the user shared, don't have the model
    // write a "personal to what they said" reply around unrelated declarations
    // — that's the same fabrication risk /ask and /series-chat already refuse.
    // Say so plainly and let the (still real, still Rev. Peter's) declarations
    // below stand on their own as general encouragement.
    if (noRelevantMatch) noteAbort.abort();
    const botResponse = noRelevantMatch
      ? "Nothing in Rev. Peter's messages speaks directly to that. Here are some general declarations to stand on in the meantime."
      : await replyPromise;

    return NextResponse.json({
      response: botResponse,
      declarations: toReturn,
      hasMore,
      // The declarations below are general encouragement, not answers to what
      // was shared — the UI says so plainly instead of titling them "A word
      // for you", which would read as if they had been chosen for this person.
      general: noRelevantMatch,
    });

  } catch (error) {
    console.error("[api/declarations] POST error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve declarations. Please try again." },
      { status: 500 }
    );
  }
}