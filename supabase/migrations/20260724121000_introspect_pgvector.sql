-- temporary introspection helper (dropped immediately after reading)
create or replace function _audit_pgvector_info()
returns table (extversion text, pg_ver text)
language sql stable as $$
  select (select extversion from pg_extension where extname = 'vector'),
         current_setting('server_version');
$$;
