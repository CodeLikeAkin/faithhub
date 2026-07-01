// app/api/declarations/route.js
// Replaces keyword/topic matching with semantic vector search.
// Flow: embed message → match_declarations RPC → Groq response

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDeclarations } from "@/lib/groq";

const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if (!serviceKey) {
  throw new Error('SUPABASE_SERVICE_KEY is required for the declarations API');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey
);

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
  try {
    const { message, shownIds = [] } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // ── 1. Embed the user's message ──────────────────────────
    let queryEmbedding;
    let embeddingFailed = false;
    try {
      queryEmbedding = await embedText(message);
    } catch (embedErr) {
      console.error("[declarations] Embed failed:", embedErr.message);
      embeddingFailed = true;
      queryEmbedding = null;
    }

    let declarations = [];

    // ── 2. Hybrid search (semantic + keyword, RRF-fused) ─────────────────────
    // Keyword recall catches exact phrases/scripture the small embedding model
    // misses. If embedding failed, queryEmbedding is null and the hybrid RPC
    // degrades to keyword-only rather than falling straight to random.
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

    // ── 3. Fallback: random declarations if semantic returns nothing ──
    if (declarations.length === 0) {
      const reason = embeddingFailed
        ? "embedding service unavailable"
        : "semantic search returned no results";
      console.warn(`[declarations] Using fallback (${reason}). User will receive random declarations instead of semantically relevant ones.`);
      let query = supabase
        .from("declarations")
        .select(`
          id,
          declaration_text,
          youtube_url_with_timestamp,
          topic_tags,
          sermons (title)
        `);

      if (shownIds.length > 0) {
        query = query.not("id", "in", `(${shownIds.map(id => `'${id}'`).join(',')})`);
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
    }

    // ── 4. Deduplicate by declaration text ────────────────────
    // Normalize text for comparison: lowercase, strip punctuation & extra spaces
    function normalizeText(text) {
      return (text || "")
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const seen = new Map(); // normalized text → declaration object
    for (const d of declarations) {
      const key = normalizeText(d.declaration_text);
      const existing = seen.get(key);
      if (!existing || (d.similarity || 0) > (existing.similarity || 0)) {
        seen.set(key, d);
      }
    }
    declarations = Array.from(seen.values());

    // ── 5. Shuffle for variety on each reload ────────────────
    // Fisher-Yates shuffle so the same query returns different declarations
    for (let i = declarations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [declarations[i], declarations[j]] = [declarations[j], declarations[i]];
    }

    // ── 6. Determine hasMore and slice to 10 ─────────────────
    const hasMore = declarations.length > 10;
    const toReturn = declarations.slice(0, 10).map((d) => ({
      id: d.id,
      declaration_text: d.declaration_text,
      sermon_title: d.sermon_title || "Heritage of Faith Church",
      youtube_url_with_timestamp: d.youtube_url_with_timestamp || "",
      topic_tags: d.topic_tags || [],
    }));

    // ── 6b. No declarations at all → data layer is down or empty. ──
    // Do NOT fabricate a pastoral paragraph with nothing behind it (that is what
    // made the paused-database outage look like a working "write-up"). Fail loud.
    if (toReturn.length === 0) {
      console.error("[declarations] No declarations available — data layer unreachable or empty. Returning 503 instead of a fabricated response.");
      return NextResponse.json(
        { error: "Declarations library is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }

    // ── 7. Generate pastoral AI response via Groq ────────────
    const botResponse = await getDeclarations(message, toReturn);

    return NextResponse.json({
      response: botResponse,
      declarations: toReturn,
      hasMore,
    });

  } catch (error) {
    console.error("[api/declarations] POST error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve declarations. Please try again." },
      { status: 500 }
    );
  }
}