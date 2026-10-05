// app/api/declarations/left-out/route.js
// Sermon ids the declarations pages skip (guest ministers, celebration / panel
// videos). The pages query Supabase straight from the browser, so they ask
// this for the list instead of re-deriving it from ~740 titles. ~30 ids.

import { NextResponse } from "next/server";
import { loadLeftOutSafe } from "@/lib/declarations-left-out";

export const dynamic = "force-dynamic";

export async function GET() {
  const { sermonIds } = await loadLeftOutSafe();
  return NextResponse.json(
    { sermonIds },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
