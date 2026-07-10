-- Study notes + series cache columns.
--
-- sermons.study_notes        markdown "member's notebook" notes, generated
--                            once by faithhub-pipeline/generate-notes-run.js
-- series.study_summary       the series description, generated once by the
--                            series-summary API and cached here (self-heals)
-- series.suggested_questions jsonb array of opener questions (same API)
-- series.key_verses          jsonb array of the series' most-read references,
--                            computed by faithhub-pipeline/backfill-series-cache.js
--                            (pure counting over sermon_scriptures — no AI)
-- series.key_verses_total    total scripture references across the series

alter table sermons add column if not exists study_notes text;

alter table series add column if not exists study_summary text;
alter table series add column if not exists suggested_questions jsonb;
alter table series add column if not exists key_verses jsonb;
alter table series add column if not exists key_verses_total integer;
