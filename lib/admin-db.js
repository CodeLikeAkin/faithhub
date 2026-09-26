// lib/admin-db.js
//
// Service-role Supabase client for the admin console. It bypasses RLS, so it
// must only ever be imported from server code (admin pages and /api/admin
// routes), and only after the admin check has passed.

import { createClient } from '@supabase/supabase-js';

let client;

export function adminDb() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Supabase URL or service key is not set.');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
