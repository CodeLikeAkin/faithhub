// Keep-alive endpoint — pinged daily by Vercel Cron (see vercel.json) so the
// free-tier Supabase project never sits idle long enough to auto-pause.
// It runs one trivial read; that counts as activity for Supabase.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error } = await supabase.from("series").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[keep-alive] ping failed:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
