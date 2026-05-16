// app/api/declarations/route.js
// Replaces keyword/topic matching with semantic vector search.
// Flow: embed message → match_declarations RPC → Groq response

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDeclarations } from "@/lib/gemini";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
    try {
      queryEmbedding = await embedText(message);
    } catch (embedErr) {
      console.error("[declarations] Embed failed:", embedErr.message);
      // Fallback: return generic declarations if embedding fails
      queryEmbedding = null;
    }

    let declarations = [];

    // ── 2. Semantic search via pgvector RPC ──────────────────
    if (queryEmbedding) {
      const { data, error } = await supabase.rpc("match_declarations", {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 12,
        exclude_ids: shownIds.length > 0 ? shownIds : [],
      });

      if (error) {
        console.error("[declarations] RPC error:", error.message);
      } else {
        declarations = data || [];
      }
    }

    // ── 3. Fallback: random declarations if semantic returns nothing ──
    if (declarations.length === 0) {
      console.warn("[declarations] Semantic search returned 0 results, using fallback.");
      const { data: fallback } = await supabase
        .from("declarations")
        .select(`
          id,
          declaration_text,
          youtube_url_with_timestamp,
          topic_tags,
          sermons (title)
        `)
        .not("id", "in", shownIds.length > 0 ? `(${shownIds.join(",")})` : "(00000000-0000-0000-0000-000000000000)")
        .limit(12);

      declarations = (fallback || []).map((d) => ({
        ...d,
        sermon_title: d.sermons?.title || "Heritage of Faith Church",
        similarity: 0,
      }));
    }

    // ── 4. Determine hasMore and slice to 10 ─────────────────
    const hasMore = declarations.length > 10;
    const toReturn = declarations.slice(0, 10).map((d) => ({
      id: d.id,
      declaration_text: d.declaration_text,
      sermon_title: d.sermon_title || "Heritage of Faith Church",
      youtube_url_with_timestamp: d.youtube_url_with_timestamp || "",
      topic_tags: d.topic_tags || [],
    }));

    // ── 5. Generate pastoral AI response via Groq ────────────
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