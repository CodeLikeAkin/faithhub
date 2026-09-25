// app/api/feedback/route.js
//
// The /about feedback form's endpoint. Deliberately ordered: validate →
// write the row → store any screenshots → then try to email. The Supabase row
// is the record; the Resend email is a convenience ping. If a later step fails
// the visitor still gets a success response, because their message IS saved —
// failing them over a notification they never asked about would be a lie.
//
// Spam defence, cheapest first: a honeypot field bots fill and humans can't
// see, then the shared rate limiter. No captcha — this is a church study app,
// not a signup funnel, and the volume never justifies making real people
// prove themselves.
//
// Takes multipart/form-data (the form sends screenshots as files). Screenshots
// arrive already shrunk by the browser (app/about/FeedbackForm.js); the limits
// here are the backstop, sized so three of them stay under Vercel's 4.5 MB
// request-body ceiling.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

const MAX_MESSAGE_LENGTH = 4000;
const MIN_MESSAGE_LENGTH = 5;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 ceiling
const MAX_PAGE_LENGTH = 300;

const MAX_FILES = 3;
const MAX_FILE_BYTES = 1.4 * 1024 * 1024;
const BUCKET = 'feedback-attachments'; // private — see supabase/migrations/feedback_attachments.sql

const KINDS = ['general', 'idea', 'problem', 'testimony'];

const KIND_LABELS = {
  general: 'General feedback',
  idea: 'Idea / request',
  problem: 'Something is broken',
  testimony: 'Testimony',
};

// Identify an image by its first bytes, not by the name or the declared type —
// both are whatever the client says they are.
const IMAGE_TYPES = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b.length > 12 &&
      String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF' &&
      String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP',
  },
];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || ''
);

/** Trim, collapse an empty string to null, and hard-cap the length. */
function clean(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

// Loose on purpose. The only job here is to catch a typo'd address before it
// becomes an unreplyable message — not to police which addresses are real.
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const badRequest = (error) => NextResponse.json({ error }, { status: 400 });

// Reads and checks every attached file up front, before anything is written,
// so a bad attachment rejects the whole submission cleanly instead of leaving
// a half-saved row. Returns { shots } or { error }.
async function readScreenshots(form) {
  const files = form.getAll('screenshots').filter((f) => typeof f === 'object' && f && f.size > 0);

  if (files.length > MAX_FILES) {
    return { error: `Please attach at most ${MAX_FILES} screenshots.` };
  }

  const shots = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return { error: 'One of the screenshots is too large. Try a smaller image.' };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = IMAGE_TYPES.find((t) => t.test(bytes));
    if (!type) {
      return { error: 'Screenshots must be images (JPG, PNG or WebP).' };
    }
    shots.push({ bytes, ...type });
  }
  return { shots };
}

// Uploads to <row id>/<n>.<ext>. Returns the paths that actually landed; a
// failed upload is logged and skipped, never fatal — the note is already saved.
async function storeScreenshots(id, shots) {
  const results = await Promise.all(
    shots.map(async (shot, i) => {
      const path = `${id}/${i + 1}.${shot.ext}`;
      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, shot.bytes, { contentType: shot.mime, upsert: false });
      if (error) {
        console.error(`[feedback] screenshot upload failed (${path}):`, error.message);
        return null;
      }
      return path;
    })
  );
  return results.filter(Boolean);
}

// Fires the notification email. Returns true only on a confirmed send, so the
// caller can stamp notified_at honestly. Never throws — every failure path
// logs and returns false.
async function sendNotification({ id, kind, name, email, message, page, shots }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO_EMAIL;
  // Resend's shared sender works with no domain setup at all, but it can only
  // deliver to the address that owns the Resend account. Verify a domain and
  // set FEEDBACK_FROM_EMAIL to send from your own.
  const from = process.env.FEEDBACK_FROM_EMAIL || 'FaithHub <onboarding@resend.dev>';

  if (!apiKey || !to) {
    console.warn('[feedback] RESEND_API_KEY / FEEDBACK_TO_EMAIL not set — row saved, no email sent.');
    return false;
  }

  const label = KIND_LABELS[kind] || kind;
  const who = name || 'Someone';

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#17233B;line-height:1.6">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7A7A7A">
        FaithHub &middot; ${escapeHtml(label)}
      </p>
      <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(who)} sent feedback</h2>
      <div style="white-space:pre-wrap;background:#EAF2FB;border-radius:12px;padding:16px;font-size:15px">${escapeHtml(message)}</div>
      <table style="margin-top:20px;font-size:13px;color:#7A7A7A;border-collapse:collapse">
        <tr><td style="padding:2px 12px 2px 0">From</td><td>${escapeHtml(name || '—')}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Reply to</td><td>${email ? escapeHtml(email) : 'no address given'}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Sent from</td><td>${escapeHtml(page || '—')}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Screenshots</td><td>${shots.length ? `${shots.length} attached` : 'none'}</td></tr>
        <tr><td style="padding:2px 12px 2px 0">Row</td><td>${escapeHtml(id)}</td></tr>
      </table>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `FaithHub — ${label}${name ? ` from ${name}` : ''}`,
        html,
        // So hitting reply in your mail client goes to the person, not to the
        // sending domain. Only when they actually left an address.
        ...(email ? { reply_to: email } : {}),
        // Attached straight from the validated bytes, so the email carries the
        // screenshots even if the storage upload failed.
        ...(shots.length
          ? {
              attachments: shots.map((s, i) => ({
                filename: `screenshot-${i + 1}.${s.ext}`,
                content: Buffer.from(s.bytes).toString('base64'),
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      console.error('[feedback] Resend rejected the send:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[feedback] Resend request failed:', err);
    return false;
  }
}

export async function POST(request) {
  // Far tighter than the AI routes: nobody has a legitimate reason to send
  // more than a handful of notes in ten minutes.
  const rl = await rateLimit(request, { max: 4, windowMs: 10 * 60_000, prefix: 'feedback' });
  if (!rl.allowed) return rateLimitResponse(rl);

  let form;
  try {
    form = await request.formData();
  } catch {
    return badRequest('Invalid request body.');
  }

  // Honeypot: a hidden field no sighted user ever sees. Anything in it is a
  // bot, and we answer with a normal success so it never learns it was caught.
  if (clean(form.get('website'), 200)) {
    return NextResponse.json({ ok: true });
  }

  const message = clean(form.get('message'), MAX_MESSAGE_LENGTH);
  if (!message || message.length < MIN_MESSAGE_LENGTH) {
    return badRequest('Please write a little more so we can act on it.');
  }

  const email = clean(form.get('email'), MAX_EMAIL_LENGTH);
  if (email && !looksLikeEmail(email)) {
    return badRequest("That email address doesn't look right.");
  }

  const { shots, error: shotError } = await readScreenshots(form);
  if (shotError) return badRequest(shotError);

  const rawKind = form.get('kind');
  const kind = KINDS.includes(rawKind) ? rawKind : 'general';
  const name = clean(form.get('name'), MAX_NAME_LENGTH);
  const page = clean(form.get('page'), MAX_PAGE_LENGTH);

  const { data, error } = await supabaseAdmin
    .from('feedback')
    .insert({
      kind,
      name,
      email,
      message,
      page,
      user_agent: clean(request.headers.get('user-agent'), 400),
      client_id: clean(request.headers.get('x-client-id'), 100),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[feedback] insert failed:', error);
    return NextResponse.json(
      { error: "We couldn't save that just now. Please try again in a moment." },
      { status: 500 }
    );
  }

  // Only touch the attachments column when there's something to record, so
  // plain-text notes keep working even before feedback_attachments.sql runs.
  if (shots.length) {
    const paths = await storeScreenshots(data.id, shots);
    if (paths.length) {
      const { error: pathError } = await supabaseAdmin
        .from('feedback')
        .update({ attachments: paths })
        .eq('id', data.id);
      if (pathError) console.error('[feedback] could not record attachment paths:', pathError.message);
    }
  }

  const notified = await sendNotification({ id: data.id, kind, name, email, message, page, shots });
  if (notified) {
    await supabaseAdmin
      .from('feedback')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', data.id);
  }

  return NextResponse.json({ ok: true });
}
