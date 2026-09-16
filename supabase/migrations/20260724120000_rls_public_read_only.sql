-- 20260724120000_rls_public_read_only.sql
--
-- SECURITY FIX (pre-launch audit, blocker #3).
-- The public anon key could INSERT / UPDATE / DELETE on `declarations`,
-- `sermons`, `series`, and `series_sermons` — anyone with the (client-side,
-- therefore public) anon key could wipe or poison the library with one request.
--
-- Intended model: PUBLIC READ, NO PUBLIC WRITE. The app only ever *reads* these
-- tables with the anon key; every write goes through the service role, which
-- BYPASSES RLS entirely. So a single `for select using(true)` policy and NO
-- write policy is the correct, complete lockdown — it keeps every existing read
-- working while removing all anon/authenticated write access.
--
-- Authoritative + idempotent: drops whatever policies currently exist on each
-- table (names unknown / overly-permissive `for all using(true)`) and recreates
-- exactly one read policy. Runs in a single transaction, so there is no window
-- where the tables are readable-but-unpoliced.

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['declarations', 'sermons', 'series', 'series_sermons']
  loop
    execute format('alter table public.%I enable row level security', t);

    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_public_read', t
    );
  end loop;
end $$;
