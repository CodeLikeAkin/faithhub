-- Screenshot attachments on /about feedback (app/api/feedback/route.js).
-- Run after feedback.sql.
--
-- Files live in a PRIVATE storage bucket at feedback-attachments/<row id>/<n>.jpg
-- and the row keeps their paths. Private + no storage policies means the
-- public anon key can neither upload nor read them; only the API route's
-- service key can, and the admin console will read them via signed URLs.

alter table feedback
  add column if not exists attachments text[];

comment on column feedback.attachments is
  'Storage paths in the feedback-attachments bucket; null = no screenshots.';

-- 2 MB per object is a backstop: the browser already shrinks screenshots to a
-- ~1920px JPEG (typically 200-500 KB) before upload, and the route rejects
-- anything over 1.4 MB. Only real image types are accepted.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-attachments',
  'feedback-attachments',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
