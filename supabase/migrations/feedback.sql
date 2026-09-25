-- Feedback sent from the /about page form (app/api/feedback/route.js).
--
-- The row is the source of truth, not the email. The API route writes here
-- FIRST and only then tries to notify via Resend — so a missing API key, a
-- rotated token or a provider outage loses a notification, never the message
-- itself. The admin console reads this table as its inbox.

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- What kind of note this is, so the inbox can triage without reading every
  -- one. Mirrors the radio group on the form.
  kind        text not null default 'general'
              check (kind in ('general', 'idea', 'problem', 'testimony')),

  -- Both optional: the form only requires the message. Someone who wants a
  -- reply leaves an email; someone who just wants to flag a typo doesn't.
  name        text,
  email       text,
  message     text not null,

  -- Context captured server-side, not asked for. `page` is where they were
  -- when they opened the form (a bug report is far more useful with it), and
  -- client_id is the same anonymous device id the rate limiter uses
  -- (lib/client-id.js) — it ties repeat notes from one person together
  -- without an account.
  page        text,
  user_agent  text,
  client_id   text,

  status      text not null default 'new'
              check (status in ('new', 'read', 'actioned', 'archived')),

  -- When the Resend notification went out. null = never sent (no API key, or
  -- the send failed) — i.e. a row worth checking the inbox for manually.
  notified_at timestamptz
);

create index if not exists feedback_created_at_idx on feedback (created_at desc);
create index if not exists feedback_status_idx on feedback (status) where status = 'new';

-- Locked down on purpose: RLS on with NO policies means the public anon key
-- can neither read nor write this table. Every insert goes through the API
-- route with SUPABASE_SERVICE_KEY (which bypasses RLS), so the route's
-- validation, honeypot and rate limit can't be skipped by posting straight at
-- PostgREST — and nobody can read other people's feedback.
alter table feedback enable row level security;

comment on table feedback is
  'Notes sent from the /about form. Service-key only — see app/api/feedback/route.js.';
comment on column feedback.notified_at is
  'When the Resend email fired; null means the row arrived but no email did.';
