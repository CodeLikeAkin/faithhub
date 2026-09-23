-- Flags sermons whose YouTube video won't play embedded elsewhere (private,
-- owner-restricted, or deleted) so the app can say so up front instead of
-- after a failed embed. Checked via YouTube's oEmbed endpoint (no API key,
-- no quota) — see .claude/faithhub-pipeline/check-video-status.js.
--
-- video_status:
--   null        not checked yet (the default — every existing row starts here)
--   'ok'        oEmbed succeeded; embeds normally
--   'private'   oEmbed 401/403 — private or blocked from playing elsewhere
--   'deleted'   oEmbed 400/404 — video no longer exists
--   'unknown'   the check itself failed (network/rate-limit) — retry next run

alter table sermons
  add column if not exists video_status text
    check (video_status in ('ok', 'private', 'deleted', 'unknown')),
  add column if not exists video_checked_at timestamptz;

comment on column sermons.video_status is
  'oEmbed result: ok / private / deleted / unknown; null = not checked yet.';
comment on column sermons.video_checked_at is
  'When video_status was last set — check-video-status.js rechecks after 7 days.';
